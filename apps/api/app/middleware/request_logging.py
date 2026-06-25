"""RequestLoggingMiddleware (§4.6).

Pure-ASGI middleware so it can safely buffer the request body (for hashing) and
capture the response status/body without the BaseHTTPMiddleware body pitfalls.

Responsibilities for EVERY request (incl. health checks):
  * Assign/propagate X-Request-ID and expose it via contextvar + scope state.
  * Time the request; emit structured stdout logs at the right level.
  * Persist one api_request_logs row after the response is sent.
"""
from __future__ import annotations

import json
import time
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings
from app.core.context import set_request_id, set_tenant_context
from app.core.logging import get_logger
from app.core.security import sha256_hex
from app.services.logging_service import persist_request_log

log = get_logger("skulpulse.request")

REQUEST_ID_HEADER = b"x-request-id"


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Reset per-request context (ASGI runs handler in this same context).
        set_tenant_context(None)

        request_id = _extract_request_id(scope) or str(uuid.uuid4())
        set_request_id(request_id)
        state = scope.setdefault("state", {})
        state["request_id"] = request_id

        # --- buffer request body (for hash only) ---
        body_chunks: list[bytes] = []

        async def receive_wrapper() -> Message:
            message = await receive()
            if message["type"] == "http.request":
                body_chunks.append(message.get("body", b""))
            return message

        # --- capture response status + body hash, inject X-Request-ID ---
        status_code = 500
        resp_chunks: list[bytes] = []

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers = [(k, v) for (k, v) in headers if k.lower() != REQUEST_ID_HEADER]
                headers.append((REQUEST_ID_HEADER, request_id.encode()))
                message = {**message, "headers": headers}
            elif message["type"] == "http.response.body":
                resp_chunks.append(message.get("body", b""))
            await send(message)

        response_started = False
        _orig_send_wrapper = send_wrapper

        async def send_wrapper(message: Message) -> None:  # noqa: F811
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await _orig_send_wrapper(message)

        start = time.perf_counter()
        try:
            await self.app(scope, receive_wrapper, send_wrapper)
        except Exception as exc:  # noqa: BLE001
            # Unhandled exception escaped the inner handlers. Own the 500 here so
            # the request_id header/body and error_code stay consistent.
            if response_started:
                raise
            from app.core.exception_handlers import handle_unhandled

            status_code = 500
            body = await handle_unhandled(
                exc, request_id, state, f"{scope.get('method', '')} {scope.get('path', '')}"
            )
            await _send_problem(send_wrapper, body, request_id)
        finally:
            duration_ms = int((time.perf_counter() - start) * 1000)
            await self._record(
                scope, state, request_id, status_code, duration_ms, body_chunks, resp_chunks
            )

    async def _record(
        self,
        scope: Scope,
        state: dict,
        request_id: str,
        status_code: int,
        duration_ms: int,
        body_chunks: list[bytes],
        resp_chunks: list[bytes],
    ) -> None:
        method = scope.get("method", "")
        path = scope.get("path", "")
        raw_qs = scope.get("query_string", b"").decode() or None
        client = scope.get("client")
        ip = client[0] if client else None
        user_agent = _header(scope, b"user-agent")

        req_body = b"".join(body_chunks)
        req_hash = (
            sha256_hex(req_body) if settings.request_log_body_hash and req_body else None
        )
        resp_body = b"".join(resp_chunks)
        resp_hash = sha256_hex(resp_body) if resp_body else None

        fields = {
            "request_id": request_id,
            "method": method,
            "path": path,
            "query_string": raw_qs,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "tenant_id": state.get("tenant_id"),
            "actor_type": state.get("actor_type", "anonymous"),
            "actor_id": state.get("actor_id"),
            "ip_address": ip,
            "user_agent": user_agent,
            "idempotency_key": state.get("idempotency_key"),
            "request_body_hash": req_hash,
            "response_body_hash": resp_hash,
            "error_code": state.get("error_code"),
        }

        level = _level_for(status_code, duration_ms)
        getattr(log, level)(
            "request.completed",
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            tenant_id=str(state["tenant_id"]) if state.get("tenant_id") else None,
            actor_type=fields["actor_type"],
            error_code=state.get("error_code"),
            ip=ip,
        )
        await persist_request_log(fields)


async def _send_problem(send: Send, body: dict, request_id: str) -> None:
    payload = json.dumps(body).encode()
    await send(
        {
            "type": "http.response.start",
            "status": body.get("status", 500),
            "headers": [
                (b"content-type", b"application/problem+json"),
                (b"content-length", str(len(payload)).encode()),
                (REQUEST_ID_HEADER, request_id.encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": payload})


def _extract_request_id(scope: Scope) -> str | None:
    value = _header(scope, REQUEST_ID_HEADER)
    if value:
        return value[:36]
    return None


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key.lower() == name:
            return value.decode("latin-1")
    return None


def _level_for(status_code: int, duration_ms: int) -> str:
    if status_code >= 500:
        return "error"
    if status_code >= 400 or duration_ms > 2000:
        return "warning"
    return "info"

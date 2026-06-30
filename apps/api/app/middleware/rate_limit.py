"""Global API rate-limit middleware."""
from __future__ import annotations

import jwt
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.client_ip import client_ip
from app.core.config import settings
from app.core.errors import RateLimitError
from app.core.logging import get_logger
from app.core.metrics import inc
from app.core.rate_limit import enforce_api_limits

log = get_logger("skulpulse.rate_limit")

# Paths exempt from global API throttling.
_EXEMPT_PREFIXES = (
    "/api/v1/health",
    "/api/v1/metrics",
)


class ApiRateLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if not settings.rate_limit_api_enabled or _is_exempt(path):
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        ip = client_ip(request)
        user_id = _extract_user_id(request)

        try:
            await enforce_api_limits(ip, user_id)
        except RateLimitError as exc:
            inc("http_requests_total", labels={"status": "429", "path_group": _path_group(path)})
            inc("rate_limit_rejections_total", labels={"path_group": _path_group(path)})
            log.warning(
                "rate_limit.api_rejected",
                path=path,
                ip=ip,
                user_id=user_id,
                retry_after=exc.extra.get("retry_after_seconds"),
            )
            body = exc.to_problem(scope.get("state", {}).get("request_id"))
            headers = {}
            retry_after = exc.extra.get("retry_after_seconds")
            if retry_after:
                headers["Retry-After"] = str(retry_after)
            response = JSONResponse(
                status_code=429,
                content=body,
                media_type="application/problem+json",
                headers=headers,
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)


def _is_exempt(path: str) -> bool:
    return any(path.startswith(prefix) for prefix in _EXEMPT_PREFIXES)


def _path_group(path: str) -> str:
    """Collapse paths for metrics cardinality (e.g. /api/v1/tenant/students/UUID)."""
    parts = path.strip("/").split("/")
    if len(parts) <= 4:
        return path
    # Keep prefix + resource type, drop UUID-like segments.
    kept: list[str] = []
    for part in parts:
        if len(part) == 36 and part.count("-") == 4:
            kept.append(":id")
        else:
            kept.append(part)
    return "/" + "/".join(kept[:6])


def _extract_user_id(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    try:
        # Decode without verification — only for rate-limit keying, not auth.
        payload = jwt.decode(token, options={"verify_signature": False})
        sub = payload.get("sub")
        token_type = payload.get("type") or payload.get("token_type")
        if sub and token_type:
            return f"{token_type}:{sub}"
    except jwt.PyJWTError:
        return None
    return None

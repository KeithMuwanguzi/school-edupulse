"""Security headers + max request body size (§4.8)."""
from __future__ import annotations

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings

MAX_BODY_BYTES = 1_000_000  # 1 MB cap on request bodies

# Strict CSP for JSON API responses. Swagger UI loads JS/CSS from jsDelivr CDN.
STRICT_CSP = b"default-src 'none'; frame-ancestors 'none'"
DOCS_CSP = (
    b"default-src 'self'; "
    b"script-src 'self' https://cdn.jsdelivr.net; "
    b"style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    b"img-src 'self' data: https://cdn.jsdelivr.net; "
    b"connect-src 'self'; "
    b"frame-ancestors 'none'"
)

DOCS_PATH_PREFIXES = (b"/api/v1/docs", b"/api/v1/redoc")


def _csp_for_path(path: str) -> bytes:
    path_bytes = path.encode()
    if any(path_bytes == p or path_bytes.startswith(p + b"/") for p in DOCS_PATH_PREFIXES):
        return DOCS_CSP
    return STRICT_CSP


BASE_HEADER_KEYS = (
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-xss-protection", b"0"),
)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Reject oversized bodies early (Content-Length based).
        for key, value in scope.get("headers", []):
            if key == b"content-length":
                try:
                    if int(value) > MAX_BODY_BYTES:
                        await _reject_413(send)
                        return
                except ValueError:
                    pass

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                path = scope.get("path", "")
                headers = list(message.get("headers", []))
                headers.extend(BASE_HEADER_KEYS)
                headers.append((b"content-security-policy", _csp_for_path(path)))
                if settings.is_production:
                    headers.append(
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                    )
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_wrapper)


async def _reject_413(send: Send) -> None:
    body = json.dumps(
        {
            "type": "https://skulpulse.ug/errors/payload-too-large",
            "title": "Payload too large",
            "status": 413,
            "code": "PAYLOAD_TOO_LARGE",
        }
    ).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/problem+json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})

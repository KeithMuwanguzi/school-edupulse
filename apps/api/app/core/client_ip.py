"""Client IP extraction with trusted reverse-proxy support."""
from __future__ import annotations

from starlette.requests import Request

from app.core.config import settings


def client_ip(request: Request) -> str | None:
    """Resolve the client IP, honoring X-Forwarded-For when behind a trusted proxy."""
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Left-most address is the original client (RFC 7239 de-facto convention).
            candidate = forwarded.split(",")[0].strip()
            if candidate:
                return candidate
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    return request.client.host if request.client else None

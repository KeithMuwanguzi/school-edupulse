"""HttpOnly refresh-token cookie helpers (§4.8, §12)."""
from __future__ import annotations

from fastapi import Request, Response

from app.core.config import settings


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    if not settings.refresh_cookie_enabled:
        return
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        max_age=settings.jwt_refresh_expire_days * 86_400,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain or None,
    )


def clear_refresh_cookie(response: Response) -> None:
    if not settings.refresh_cookie_enabled:
        return
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value="",
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        max_age=0,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain or None,
    )


def read_refresh_token(request: Request, body_token: str | None = None) -> str | None:
    """Prefer HttpOnly cookie; fall back to JSON body for tests/API clients."""
    cookie = request.cookies.get(settings.refresh_cookie_name)
    if cookie:
        return cookie
    return body_token

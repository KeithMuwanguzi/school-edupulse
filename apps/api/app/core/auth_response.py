"""Build auth responses with optional HttpOnly refresh cookie."""
from __future__ import annotations

from fastapi import Response

from app.core.config import settings
from app.core.cookies import clear_refresh_cookie, set_refresh_cookie
from app.schemas.auth import TokenResponse


def finalize_token_response(response: Response, tokens: TokenResponse) -> TokenResponse:
    """Set HttpOnly cookie and omit refresh_token from JSON when cookie auth is on."""
    if tokens.refresh_token:
        set_refresh_cookie(response, tokens.refresh_token)
    if settings.refresh_cookie_enabled:
        return TokenResponse(
            access_token=tokens.access_token,
            refresh_token=None,
            token_type=tokens.token_type,
            expires_in=tokens.expires_in,
            must_change_password=tokens.must_change_password,
        )
    return tokens


def finalize_logout_response(response: Response) -> Response:
    clear_refresh_cookie(response)
    response.status_code = 204
    return response

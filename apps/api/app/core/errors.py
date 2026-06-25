"""Application error types and RFC 7807 Problem Details (§4.7)."""
from __future__ import annotations

from typing import Any

ERROR_BASE = "https://skulpulse.ug/errors/"


class AppError(Exception):
    """Base application error rendered as RFC 7807 Problem Details."""

    status_code: int = 400
    code: str = "APP_ERROR"
    title: str = "Application error"
    log_error: bool = False  # if True, also persist to error_logs

    def __init__(
        self,
        detail: str | None = None,
        *,
        extra: dict[str, Any] | None = None,
        title: str | None = None,
    ) -> None:
        self.detail = detail or self.title
        self.extra = extra or {}
        if title:
            self.title = title
        super().__init__(self.detail)

    def to_problem(self, request_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {
            "type": f"{ERROR_BASE}{self.code.lower().replace('_', '-')}",
            "title": self.title,
            "status": self.status_code,
            "detail": self.detail,
            "code": self.code,
        }
        if request_id:
            body["request_id"] = request_id
        body.update(self.extra)
        return body


class AuthenticationError(AppError):
    status_code = 401
    code = "AUTHENTICATION_FAILED"
    title = "Authentication failed"


class InvalidCredentialsError(AuthenticationError):
    code = "INVALID_CREDENTIALS"
    title = "Invalid credentials"


class TokenError(AuthenticationError):
    code = "INVALID_TOKEN"
    title = "Invalid or expired token"


class TokenReuseError(AuthenticationError):
    code = "TOKEN_REUSE_DETECTED"
    title = "Refresh token reuse detected"
    log_error = True  # CRITICAL security event


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"
    title = "Forbidden"


class ModuleNotSubscribedError(ForbiddenError):
    code = "MODULE_NOT_SUBSCRIBED"
    title = "Module not subscribed"

    def __init__(self, module: str) -> None:
        super().__init__(
            detail=f"The '{module}' module is not active for this school.",
            extra={"module": module, "upgrade_url": "/app/settings/modules"},
        )


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"
    title = "Resource not found"


class TenantNotFoundError(NotFoundError):
    code = "TENANT_NOT_FOUND"
    title = "School not found"


class SchoolSuspendedError(ForbiddenError):
    code = "SCHOOL_SUSPENDED"
    title = "School account is not active"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"
    title = "Conflict"


class DuplicateSchoolCodeError(ConflictError):
    code = "DUPLICATE_SCHOOL_CODE"
    title = "School code already taken"


class DuplicateEmisError(ConflictError):
    code = "DUPLICATE_EMIS_NUMBER"
    title = "EMIS number already registered"


class IdempotencyConflictError(ConflictError):
    code = "IDEMPOTENCY_KEY_REUSED"
    title = "Idempotency key reused with a different payload"


class StaleVersionError(ConflictError):
    code = "STALE_VERSION"
    title = "Resource was modified by someone else"


class ValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"
    title = "Validation failed"


class RateLimitError(AppError):
    status_code = 429
    code = "RATE_LIMITED"
    title = "Too many requests"

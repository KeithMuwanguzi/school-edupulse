"""Global exception handlers → RFC 7807 Problem Details + error_logs (§4.6, §4.7)."""
from __future__ import annotations

import traceback

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.context import get_request_id
from app.core.errors import AppError
from app.core.logging import get_logger
from app.services.logging_service import persist_error_log

log = get_logger("skulpulse.error")

PROBLEM_CONTENT_TYPE = "application/problem+json"


def _state(request: Request) -> dict:
    return request.scope.setdefault("state", {})


def _endpoint(request: Request) -> str:
    return f"{request.method} {request.url.path}"


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    request_id = get_request_id()
    state = _state(request)
    state["error_code"] = exc.code

    body = exc.to_problem(request_id)

    if exc.log_error or exc.status_code >= 500:
        level = "critical" if exc.status_code < 500 and exc.log_error else "error"
        log.log(40, "app_error", code=exc.code, status=exc.status_code, detail=exc.detail)
        await persist_error_log(
            {
                "request_id": request_id or "unknown",
                "level": level,
                "error_type": type(exc).__name__,
                "error_code": exc.code,
                "message": exc.detail,
                "stack_trace": None,
                "endpoint": _endpoint(request),
                "tenant_id": state.get("tenant_id"),
                "actor_id": state.get("actor_id"),
                "context": exc.extra or None,
            }
        )
    return JSONResponse(
        status_code=exc.status_code, content=body, media_type=PROBLEM_CONTENT_TYPE
    )


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = get_request_id()
    state = _state(request)
    state["error_code"] = "VALIDATION_ERROR"

    errors = [
        {
            "field": ".".join(str(p) for p in err.get("loc", []) if p != "body"),
            "message": err.get("msg", "Invalid value"),
        }
        for err in exc.errors()
    ]
    detail_parts = []
    for err in errors[:5]:
        field = err["field"] or "request"
        detail_parts.append(f"{field}: {err['message']}")
    detail = "; ".join(detail_parts)
    if len(errors) > 5:
        detail = f"{detail}; (+{len(errors) - 5} more)"
    # WARNING level, no stack trace (§4.6) and no PII (field names only).
    log.warning("validation_error", fields=[e["field"] for e in errors])
    body = {
        "type": "https://skulpulse.ug/errors/validation",
        "title": "Validation failed",
        "status": 422,
        "detail": detail or "One or more fields are invalid.",
        "code": "VALIDATION_ERROR",
        "request_id": request_id,
        "errors": errors,
    }
    return JSONResponse(status_code=422, content=body, media_type=PROBLEM_CONTENT_TYPE)


_HTTP_TITLES = {
    400: ("Bad request", "BAD_REQUEST"),
    401: ("Authentication required", "AUTHENTICATION_FAILED"),
    403: ("Forbidden", "FORBIDDEN"),
    404: ("Not found", "NOT_FOUND"),
    405: ("Method not allowed", "METHOD_NOT_ALLOWED"),
    429: ("Too many requests", "RATE_LIMITED"),
}


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Wrap framework HTTPExceptions (e.g. 404 for unknown routes, 405) in the
    same RFC 7807 envelope so clients always get a consistent error shape."""
    request_id = get_request_id()
    state = _state(request)
    title, code = _HTTP_TITLES.get(exc.status_code, ("Request failed", "HTTP_ERROR"))
    state["error_code"] = code
    detail = exc.detail if isinstance(exc.detail, str) and exc.detail else title
    body = {
        "type": f"https://skulpulse.ug/errors/{code.lower().replace('_', '-')}",
        "title": title,
        "status": exc.status_code,
        "detail": detail,
        "code": code,
        "request_id": request_id,
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=body,
        media_type=PROBLEM_CONTENT_TYPE,
        headers=getattr(exc, "headers", None),
    )


async def handle_unhandled(
    exc: Exception, request_id: str | None, state: dict, endpoint: str
) -> dict:
    """Persist an error_logs row for an unhandled exception and return the
    Problem Details body. Called by RequestLoggingMiddleware (which sits inside
    Starlette's ServerErrorMiddleware and must own the 500 response so the
    request_id/header/error_code stay consistent)."""
    state["error_code"] = "INTERNAL_ERROR"
    log.error("unhandled_exception", error=type(exc).__name__, detail=str(exc))
    await persist_error_log(
        {
            "request_id": request_id or "unknown",
            "level": "error",
            "error_type": type(exc).__name__,
            "error_code": "INTERNAL_ERROR",
            "message": "Internal server error",  # sanitized — no internals to client
            "stack_trace": "".join(traceback.format_exception(exc)),
            "endpoint": endpoint,
            "tenant_id": state.get("tenant_id"),
            "actor_id": state.get("actor_id"),
            "context": None,
        }
    )
    return {
        "type": "https://skulpulse.ug/errors/internal",
        "title": "Internal server error",
        "status": 500,
        "code": "INTERNAL_ERROR",
        "request_id": request_id,
    }


def register_exception_handlers(app) -> None:
    # AppError + validation are handled by the inner ExceptionMiddleware and flow
    # back as normal responses (captured by the logging middleware). Unhandled
    # exceptions are owned by RequestLoggingMiddleware (see handle_unhandled).
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

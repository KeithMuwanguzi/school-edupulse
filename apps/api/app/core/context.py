"""Per-request context via contextvars (§4.1).

`TenantContext` is resolved once per request from the JWT and never trusted from
the client body/query. Repositories read `tenant_id` from here — never as an
optional parameter.
"""
from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class TenantContext:
    tenant_id: UUID
    user_id: UUID
    role: str
    modules: tuple[str, ...] = ()


# Correlation id for the in-flight request (set by RequestLoggingMiddleware).
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)

# Tenant scope for the in-flight request (set after auth on tenant routes).
_tenant_ctx: ContextVar[TenantContext | None] = ContextVar("tenant_ctx", default=None)


def set_request_id(value: str) -> None:
    _request_id.set(value)


def get_request_id() -> str | None:
    return _request_id.get()


def set_tenant_context(ctx: TenantContext | None) -> None:
    _tenant_ctx.set(ctx)


def get_tenant_context() -> TenantContext | None:
    return _tenant_ctx.get()


def require_tenant_context() -> TenantContext:
    ctx = _tenant_ctx.get()
    if ctx is None:
        raise RuntimeError("Tenant context not set — this is a tenant-scoped operation")
    return ctx

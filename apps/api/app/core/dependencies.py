"""FastAPI dependencies: DB session, auth principals, tenant context, module gate."""
from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, set_tenant_context
from app.core.db import apply_bypass_guc, apply_tenant_guc, get_session
from app.core.errors import ForbiddenError, ModuleNotSubscribedError, TokenError
from app.core.security import decode_token

bearer = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    user_id: UUID
    type: str  # platform_admin | tenant_user
    role: str | None = None
    tenant_id: UUID | None = None
    school_code: str | None = None
    modules: tuple[str, ...] = field(default_factory=tuple)


def _set_actor_state(request: Request, principal: Principal) -> None:
    state = request.scope.setdefault("state", {})
    state["actor_type"] = principal.type
    state["actor_id"] = principal.user_id
    if principal.tenant_id:
        state["tenant_id"] = principal.tenant_id


async def get_principal(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> Principal:
    if creds is None or not creds.credentials:
        raise TokenError("Missing bearer token.")
    try:
        payload = decode_token(creds.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Access token has expired.") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("Access token is invalid.") from exc

    if payload.get("token_type") != "access":
        raise TokenError("Wrong token type.")

    modules = tuple(payload.get("modules") or [])
    tenant_id = payload.get("tenant_id")
    principal = Principal(
        user_id=UUID(payload["sub"]),
        type=payload["type"],
        role=payload.get("role"),
        tenant_id=UUID(tenant_id) if tenant_id else None,
        school_code=payload.get("school_code"),
        modules=modules,
    )
    _set_actor_state(request, principal)
    return principal


async def require_platform_admin(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.type != "platform_admin":
        raise ForbiddenError("Platform administrator access required.")
    return principal


async def get_platform_session(
    _: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> AsyncSession:
    """Platform-admin session with RLS bypass enabled for cross-tenant access."""
    await apply_bypass_guc(session)
    return session


async def get_tenant_context(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> TenantContext:
    """Tenant routes: enforce tenant_user, set the RLS GUC + contextvar."""
    if principal.type != "tenant_user" or principal.tenant_id is None:
        raise ForbiddenError("Tenant access required.")
    ctx = TenantContext(
        tenant_id=principal.tenant_id,
        user_id=principal.user_id,
        role=principal.role or "",
        modules=principal.modules,
    )
    set_tenant_context(ctx)
    await apply_tenant_guc(session, ctx.tenant_id)
    return ctx


def require_role(*roles: str):
    """Dependency factory: require the tenant user to hold one of `roles`."""

    async def _dep(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if ctx.role not in roles:
            raise ForbiddenError(f"This action requires role: {', '.join(roles)}.")
        return ctx

    return _dep


def require_module(module_key: str):
    """Dependency factory: block requests whose tenant lacks an active module.

    Uses the modules carried in the JWT (refreshed from the entitlement cache on
    token rotation) — no DB hit on the hot path (§4.2)."""

    async def _dep(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if module_key not in ctx.modules:
            raise ModuleNotSubscribedError(module_key)
        return ctx

    return _dep

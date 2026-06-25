"""Authentication routes (§6.1)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import Principal, get_principal
from app.core.rate_limit import enforce_login_limits
from app.models.enums import ActorType, UserType
from app.models.platform import PlatformAdmin, Tenant
from app.models.user import Role, TenantUser
from app.schemas.auth import (
    MeResponse,
    PlatformLoginRequest,
    RefreshRequest,
    TenantLoginRequest,
    TenantSummary,
    TokenResponse,
)
from app.services import auth_service
from app.services.audit_service import record_audit
from app.services.subscription_service import (
    effective_module_keys,
    get_active_module_keys,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.post("/platform/login", response_model=TokenResponse)
async def platform_login(
    body: PlatformLoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    await enforce_login_limits(_client_ip(request), body.email)
    admin = await auth_service.authenticate_platform(session, body.email, body.password)
    claims = await auth_service.build_claims(session, UserType.platform_admin, admin.id)
    tokens = await auth_service.issue_tokens(session, UserType.platform_admin, admin.id, claims)
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=admin.id,
        action="auth.login",
        resource_type="platform_admin",
        resource_id=admin.id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return tokens


@router.post("/tenant/login", response_model=TokenResponse)
async def tenant_login(
    body: TenantLoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    await enforce_login_limits(_client_ip(request), body.username)
    user, tenant = await auth_service.authenticate_tenant(
        session, body.username, body.password
    )
    claims = await auth_service.build_claims(session, UserType.tenant_user, user.id)
    tokens = await auth_service.issue_tokens(session, UserType.tenant_user, user.id, claims)

    user.last_login_at = datetime.now(timezone.utc)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=user.id,
        tenant_id=tenant.id,
        action="auth.login",
        resource_type="tenant_user",
        resource_id=user.id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    tokens = await auth_service.rotate_tokens(session, body.refresh_token)
    await session.commit()
    return tokens


@router.post("/logout", status_code=204, response_class=Response)
async def logout(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> Response:
    await auth_service.revoke_token(session, body.refresh_token)
    await session.commit()
    return Response(status_code=204)


@router.get("/me", response_model=MeResponse)
async def me(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    if principal.type == "platform_admin":
        admin = await session.get(PlatformAdmin, principal.user_id)
        return MeResponse(
            id=admin.id,
            type="platform_admin",
            name=admin.name,
            email=admin.email,
            role="platform_admin",
        )

    # Reading tenant_users requires the RLS GUC for this tenant.
    await apply_tenant_guc(session, principal.tenant_id)
    user = await session.get(TenantUser, principal.user_id)
    role = await session.get(Role, user.role_id)
    tenant = await session.get(Tenant, user.tenant_id)
    role_key = role.role_key if role else ""
    tenant_modules = await get_active_module_keys(session, user.tenant_id)
    modules = effective_module_keys(tenant_modules, role_key, user.allowed_modules)
    return MeResponse(
        id=user.id,
        type="tenant_user",
        name=user.name,
        email=user.email,
        role=role_key,
        login_id=user.login_id,
        tenant=TenantSummary(
            id=tenant.id, school_code=tenant.school_code, status=tenant.status.value
        ),
        modules=modules,
    )

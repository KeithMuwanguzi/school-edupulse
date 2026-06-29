"""Tenant user management — Phase 2 §4 (settings, no module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import get_tenant_context, require_role
from app.models.enums import ActorType, UserStatus
from app.schemas.tenant_user import (
    GuardianImportRequest,
    ImportUsersResponse,
    NextLoginIdOut,
    PasswordResetResponse,
    RoleOption,
    TeacherImportRequest,
    TenantUserCreate,
    TenantUserOut,
    TenantUserUpdate,
)
from app.services import tenant_user_service
from app.services import user_import_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:users"])

_admin = require_role("school_admin")
# Account directory is sensitive; only admins (and deputies, who pick wardens
# and link guardian accounts) may enumerate portal users.
_directory = require_role("school_admin", "deputy_head")


@router.get("/roles", response_model=list[RoleOption])
async def list_roles(
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> list[RoleOption]:
    return await tenant_user_service.list_assignable_roles(session)


@router.get("/users/next-login-id", response_model=NextLoginIdOut)
async def next_login_id(
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> NextLoginIdOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    login_id = await tenant_user_service.allocate_next_login_id(session, ctx.tenant_id)
    return NextLoginIdOut(login_id=login_id)


@router.get("/users", response_model=list[TenantUserOut])
async def list_users(
    role: str | None = None,
    ctx: TenantContext = Depends(_directory),
    session: AsyncSession = Depends(get_session),
) -> list[TenantUserOut]:
    return await tenant_user_service.list_users(session, ctx.tenant_id, role_key=role)


@router.post("/users", response_model=TenantUserOut, status_code=201)
async def create_user(
    body: TenantUserCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> TenantUserOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await tenant_user_service.create_user(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="user.created",
        resource_type="tenant_user",
        resource_id=result.id,
        metadata={"login_id": result.login_id, "role": result.role},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/users/{user_id}", response_model=TenantUserOut)
async def update_user(
    user_id: UUID,
    body: TenantUserUpdate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> TenantUserOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await tenant_user_service.update_user(
        session, ctx.tenant_id, user_id, body, ctx.user_id
    )
    action = "user.disabled" if body.status == UserStatus.disabled else "user.updated"
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action=action,
        resource_type="tenant_user",
        resource_id=user_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/users/{user_id}/password-reset", response_model=PasswordResetResponse)
async def reset_password(
    user_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> PasswordResetResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    from sqlalchemy import select

    from app.models.school import School

    school_name = await session.scalar(
        select(School.name).where(School.tenant_id == ctx.tenant_id)
    )
    result = await tenant_user_service.reset_user_password(
        session,
        ctx.tenant_id,
        user_id,
        school_name=school_name or ctx.tenant_id.hex[:8],
        reset_by="School administrator",
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="user.password_reset",
        resource_type="tenant_user",
        resource_id=user_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/users/import/teachers", response_model=ImportUsersResponse)
async def import_teachers(
    body: TeacherImportRequest,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> ImportUsersResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await user_import_service.import_teachers(
        session,
        ctx.tenant_id,
        body.rows,
        default_password=body.default_password,
        generate_passwords=body.generate_passwords,
        line_offset=body.line_offset,
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="users.import.teachers",
        resource_type="tenant_user",
        resource_id=None,
        metadata={"created": result.created, "skipped": result.skipped, "failed": result.failed},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/users/import/guardians", response_model=ImportUsersResponse)
async def import_guardians(
    body: GuardianImportRequest,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> ImportUsersResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await user_import_service.import_guardians(
        session,
        ctx.tenant_id,
        body.rows,
        default_password=body.default_password,
        generate_passwords=body.generate_passwords,
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="users.import.guardians",
        resource_type="tenant_user",
        resource_id=None,
        metadata={"created": result.created, "skipped": result.skipped, "failed": result.failed},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result

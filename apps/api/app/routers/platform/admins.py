"""Platform administrator directory — create, deactivate, delete, password reset."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import Principal, get_platform_session, require_platform_admin
from app.models.platform import PlatformAdmin
from app.models.enums import ActorType
from app.schemas.platform_admin import (
    PlatformAdminCreate,
    PlatformAdminCreateResponse,
    PlatformAdminOut,
    PlatformAdminUpdate,
)
from app.schemas.tenant_user import PasswordResetResponse
from app.services import platform_admin_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/platform/admins", tags=["platform:admins"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[PlatformAdminOut])
async def list_admins(
    session: AsyncSession = Depends(get_platform_session),
) -> list[PlatformAdminOut]:
    return await platform_admin_service.list_admins(session)


@router.post("", response_model=PlatformAdminCreateResponse, status_code=201)
async def create_admin(
    body: PlatformAdminCreate,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> PlatformAdminCreateResponse:
    actor = await session.get(PlatformAdmin, principal.user_id)
    created_by = actor.name if actor else "Platform administrator"
    result = await platform_admin_service.create_admin(
        session, body, created_by=created_by
    )
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        action="platform_admin.created",
        resource_type="platform_admin",
        resource_id=result.admin.id,
        metadata={"email": result.admin.email, "email_sent": result.email_sent},
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return result


@router.patch("/{admin_id}", response_model=PlatformAdminOut)
async def update_admin(
    admin_id: UUID,
    body: PlatformAdminUpdate,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> PlatformAdminOut:
    result = await platform_admin_service.update_admin(
        session, admin_id, body, actor_id=principal.user_id
    )
    action = (
        "platform_admin.deactivated"
        if body.is_active is False
        else "platform_admin.reactivated"
        if body.is_active is True
        else "platform_admin.updated"
    )
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        action=action,
        resource_type="platform_admin",
        resource_id=admin_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return result


@router.delete("/{admin_id}", status_code=204, response_class=Response)
async def delete_admin(
    admin_id: UUID,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> Response:
    await platform_admin_service.delete_admin(
        session, admin_id, actor_id=principal.user_id
    )
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        action="platform_admin.deleted",
        resource_type="platform_admin",
        resource_id=admin_id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return Response(status_code=204)


@router.post("/{admin_id}/password-reset", response_model=PasswordResetResponse)
async def reset_password(
    admin_id: UUID,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> PasswordResetResponse:
    actor = await session.get(PlatformAdmin, principal.user_id)
    reset_by = actor.name if actor else "Platform administrator"
    result = await platform_admin_service.reset_admin_password(
        session, admin_id, reset_by=reset_by
    )
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        action="platform_admin.password_reset",
        resource_type="platform_admin",
        resource_id=admin_id,
        metadata={"email_sent": result.email_sent},
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return result

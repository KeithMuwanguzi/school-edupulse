"""Tenant circulars — parent announcements."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import get_tenant_context, require_role
from app.core.errors import NotFoundError
from app.models.enums import ActorType, CircularStatus
from app.schemas.circular import CircularCreate, CircularOut, CircularUpdate
from app.services import circular_attachment_service, circular_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:circulars"])

ADMIN_ROLES = ("school_admin", "deputy_head")


@router.get("/circulars/inbox", response_model=list[CircularOut])
async def list_circular_inbox(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> list[CircularOut]:
    if ctx.role == "parent" and "parents_portal" not in ctx.modules:
        from app.services.parent_portal_accounts import ParentPortalUnavailableError

        raise ParentPortalUnavailableError()
    await apply_tenant_guc(session, ctx.tenant_id)
    return await circular_service.list_inbox(
        session, ctx.tenant_id, ctx.user_id, ctx.role
    )


@router.get("/circulars", response_model=list[CircularOut])
async def list_circulars_admin(
    status: str | None = Query(default=None, pattern="^(draft|published|archived)$"),
    ctx: TenantContext = Depends(require_role(*ADMIN_ROLES)),
    session: AsyncSession = Depends(get_session),
) -> list[CircularOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    parsed = CircularStatus(status) if status else None
    return await circular_service.list_admin(session, ctx.tenant_id, status=parsed)


@router.get("/circulars/{circular_id}", response_model=CircularOut)
async def get_circular(
    circular_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> CircularOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await circular_service.get_circular(session, ctx.tenant_id, circular_id)


@router.post("/circulars", response_model=CircularOut, status_code=201)
async def create_circular(
    body: CircularCreate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> CircularOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await circular_service.create_circular(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="circular.created",
        resource_type="circular",
        resource_id=result.id,
        metadata={"title": result.title, "audience": result.audience},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/circulars/{circular_id}", response_model=CircularOut)
async def update_circular(
    circular_id: UUID,
    body: CircularUpdate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> CircularOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await circular_service.update_circular(
        session, ctx.tenant_id, circular_id, body
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="circular.updated",
        resource_type="circular",
        resource_id=circular_id,
        metadata={"title": result.title, "status": result.status},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/circulars/{circular_id}/publish", response_model=CircularOut)
async def publish_circular(
    circular_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> CircularOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await circular_service.publish_circular(
        session, ctx.tenant_id, circular_id, ctx.user_id
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="circular.published",
        resource_type="circular",
        resource_id=circular_id,
        metadata={"title": result.title, "audience": result.audience},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete(
    "/circulars/{circular_id}",
    status_code=204,
    response_class=Response,
)
async def delete_circular(
    circular_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await circular_service.delete_circular(session, ctx.tenant_id, circular_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="circular.deleted",
        resource_type="circular",
        resource_id=circular_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)


@router.post("/circulars/{circular_id}/attachment", response_model=CircularOut)
async def upload_circular_attachment(
    circular_id: UUID,
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> CircularOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    await circular_service.get_circular(session, ctx.tenant_id, circular_id)
    filename, _ = await circular_attachment_service.save_attachment(
        ctx.tenant_id, circular_id, file
    )
    result = await circular_service.set_attachment_filename(
        session, ctx.tenant_id, circular_id, filename
    )
    await session.commit()
    return result


@router.delete("/circulars/{circular_id}/attachment", response_model=CircularOut)
async def delete_circular_attachment(
    circular_id: UUID,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> CircularOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    circular_attachment_service.remove_attachment(ctx.tenant_id, circular_id)
    result = await circular_service.set_attachment_filename(
        session, ctx.tenant_id, circular_id, None
    )
    await session.commit()
    return result


@router.get("/circulars/{circular_id}/attachment")
async def download_circular_attachment(
    circular_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    circular = await circular_service.get_circular(session, ctx.tenant_id, circular_id)
    if circular.status != "published" and ctx.role not in ADMIN_ROLES:
        raise NotFoundError("Circular not found.")
    if ctx.role == "parent":
        inbox = await circular_service.list_inbox(
            session, ctx.tenant_id, ctx.user_id, ctx.role
        )
        if not any(item.id == circular_id for item in inbox):
            raise NotFoundError("Circular not found.")
    path = circular_attachment_service.circular_attachment_path(ctx.tenant_id, circular_id)
    if path is None:
        raise NotFoundError("Attachment not found.")
    return FileResponse(
        path,
        media_type=circular_attachment_service.attachment_media_type(path),
        filename=circular.attachment_filename or path.name,
    )

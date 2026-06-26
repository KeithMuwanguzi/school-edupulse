"""Tenant classes & streams — Phase 2 §3 (`academics` module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.models.enums import ActorType
from app.schemas.school_class import (
    ClassCreate,
    ClassOut,
    ClassUpdate,
    StreamCreate,
    StreamUpdate,
)
from app.services import class_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:classes"])

_academics = require_module("academics")
_admin = require_role("school_admin")


@router.get("/classes", response_model=list[ClassOut])
async def list_classes(
    ctx: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> list[ClassOut]:
    return await class_service.list_classes(session, ctx.tenant_id)


@router.post("/classes", response_model=ClassOut, status_code=201)
async def create_class(
    body: ClassCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> ClassOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await class_service.create_class(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="class.created",
        resource_type="class",
        resource_id=result.id,
        metadata={"level": result.level, "label": result.label},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/classes/setup-primary", response_model=list[ClassOut])
async def setup_primary_classes(
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> list[ClassOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await class_service.setup_primary_classes(session, ctx.tenant_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="class.setup_primary",
        resource_type="class",
        resource_id=ctx.tenant_id,
        metadata={"count": len(result)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/classes/setup-nursery", response_model=list[ClassOut])
async def setup_nursery_classes(
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> list[ClassOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await class_service.setup_nursery_classes(session, ctx.tenant_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="class.setup_nursery",
        resource_type="class",
        resource_id=ctx.tenant_id,
        metadata={"count": len(result)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/classes/{class_id}", response_model=ClassOut)
async def update_class(
    class_id: UUID,
    body: ClassUpdate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> ClassOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await class_service.update_class(session, ctx.tenant_id, class_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="class.updated",
        resource_type="class",
        resource_id=class_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete("/classes/{class_id}", status_code=204, response_class=Response)
async def delete_class(
    class_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await class_service.delete_class(session, ctx.tenant_id, class_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="class.deleted",
        resource_type="class",
        resource_id=class_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)


@router.post("/classes/{class_id}/streams", response_model=ClassOut, status_code=201)
async def create_stream(
    class_id: UUID,
    body: StreamCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> ClassOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await class_service.create_stream(session, ctx.tenant_id, class_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="stream.created",
        resource_type="stream",
        resource_id=result.streams[-1].id if result.streams else class_id,
        metadata={"class_id": str(class_id), "name": body.name},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/classes/{class_id}/streams/{stream_id}", response_model=ClassOut)
async def update_stream(
    class_id: UUID,
    stream_id: UUID,
    body: StreamUpdate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> ClassOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await class_service.update_stream(
        session, ctx.tenant_id, class_id, stream_id, body
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="stream.updated",
        resource_type="stream",
        resource_id=stream_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete(
    "/classes/{class_id}/streams/{stream_id}",
    response_model=ClassOut,
)
async def delete_stream(
    class_id: UUID,
    stream_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _: TenantContext = Depends(_academics),
    session: AsyncSession = Depends(get_session),
) -> ClassOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await class_service.delete_stream(session, ctx.tenant_id, class_id, stream_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="stream.deleted",
        resource_type="stream",
        resource_id=stream_id,
        metadata={"class_id": str(class_id)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result

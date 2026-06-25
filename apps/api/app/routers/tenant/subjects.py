"""Tenant subject catalogue — Phase 2 §2 (settings, no module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import get_tenant_context, require_role
from app.models.enums import ActorType
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate
from app.services import subject_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:subjects"])


@router.get("/subjects", response_model=list[SubjectOut])
async def list_subjects(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> list[SubjectOut]:
    return await subject_service.list_subjects(session, ctx.tenant_id)


@router.post("/subjects", response_model=SubjectOut, status_code=201)
async def create_subject(
    body: SubjectCreate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> SubjectOut | JSONResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result, created = await subject_service.create_subject(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="subject.created" if created else "subject.cycles_extended",
        resource_type="subject",
        resource_id=result.id,
        metadata={"code": result.code, "ncdc_cycles": result.ncdc_cycles},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    if created:
        return result
    return JSONResponse(status_code=200, content=result.model_dump(mode="json"))


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: UUID,
    body: SubjectUpdate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> SubjectOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await subject_service.update_subject(session, ctx.tenant_id, subject_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="subject.updated",
        resource_type="subject",
        resource_id=subject_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete("/subjects/{subject_id}", status_code=204, response_class=Response)
async def delete_subject(
    subject_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await subject_service.delete_subject(session, ctx.tenant_id, subject_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="subject.deleted",
        resource_type="subject",
        resource_id=subject_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)

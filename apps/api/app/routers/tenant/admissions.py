"""Tenant admissions pipeline — Phase 2 §14 (`admissions` module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.models.enums import ActorType
from app.schemas.admission import (
    AdmissionApplicationCreate,
    AdmissionApplicationOut,
    AdmissionApplicationUpdate,
    AdmissionBatchCreate,
    AdmissionBatchResponse,
    AdmissionEnrollLink,
)
from app.services import admission_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:admissions"])

_admissions = require_module("admissions")
_admin = require_role("school_admin")


@router.get("/admissions/applications", response_model=list[AdmissionApplicationOut])
async def list_applications(
    status: str | None = Query(default=None),
    ctx: TenantContext = Depends(_admissions),
    session: AsyncSession = Depends(get_session),
) -> list[AdmissionApplicationOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await admission_service.list_applications(session, ctx.tenant_id, status=status)


@router.post("/admissions/applications", response_model=AdmissionApplicationOut, status_code=201)
async def create_application(
    body: AdmissionApplicationCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_admissions),
    session: AsyncSession = Depends(get_session),
) -> AdmissionApplicationOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await admission_service.create_application(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="admissions.application.created",
        resource_type="admission_application",
        resource_id=result.id,
        metadata={"reference_number": result.reference_number},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post(
    "/admissions/applications/batch",
    response_model=AdmissionBatchResponse,
    status_code=201,
)
async def create_applications_batch(
    body: AdmissionBatchCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_admissions),
    session: AsyncSession = Depends(get_session),
) -> AdmissionBatchResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await admission_service.create_applications_batch(
        session, ctx.tenant_id, body.rows
    )
    if result.created:
        await record_audit(
            session,
            actor_type=ActorType.tenant_user,
            actor_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            action="admissions.application.batch_created",
            resource_type="admission_application",
            resource_id=None,
            metadata={"created": result.created, "failed": result.failed},
            ip_address=request.client.host if request.client else None,
        )
    await session.commit()
    return result


@router.get("/admissions/applications/{application_id}", response_model=AdmissionApplicationOut)
async def get_application(
    application_id: UUID,
    ctx: TenantContext = Depends(_admissions),
    session: AsyncSession = Depends(get_session),
) -> AdmissionApplicationOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await admission_service.get_application(session, ctx.tenant_id, application_id)


@router.patch("/admissions/applications/{application_id}", response_model=AdmissionApplicationOut)
async def update_application(
    application_id: UUID,
    body: AdmissionApplicationUpdate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_admissions),
    session: AsyncSession = Depends(get_session),
) -> AdmissionApplicationOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await admission_service.update_application(
        session, ctx.tenant_id, application_id, body
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="admissions.application.updated",
        resource_type="admission_application",
        resource_id=application_id,
        metadata={"status": result.status},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post(
    "/admissions/applications/{application_id}/enroll",
    response_model=AdmissionApplicationOut,
)
async def link_enrolled_student(
    application_id: UUID,
    body: AdmissionEnrollLink,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_admissions),
    session: AsyncSession = Depends(get_session),
) -> AdmissionApplicationOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await admission_service.link_enrolled_student(
        session, ctx.tenant_id, application_id, body.student_id
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="admissions.application.enrolled",
        resource_type="admission_application",
        resource_id=application_id,
        metadata={"student_id": str(body.student_id)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result

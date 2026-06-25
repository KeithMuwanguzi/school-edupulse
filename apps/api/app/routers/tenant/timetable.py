"""Tenant timetable — weekly lesson slots (`timetable` module gate).

Admins build the timetable; teachers read their own day to drive attendance.
"""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.core.school_time import school_today
from app.models.enums import ActorType
from app.schemas.timetable import (
    TeacherDayOut,
    TimetableImportRequest,
    TimetableImportResponse,
    TimetableSlotCreate,
    TimetableSlotOut,
    TimetableSlotUpdate,
)
from app.services import timetable_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:timetable"])

_timetable = require_module("timetable")
_admin = require_role("school_admin")


@router.get("/timetable/slots", response_model=list[TimetableSlotOut])
async def list_slots(
    academic_year_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_timetable),
    session: AsyncSession = Depends(get_session),
) -> list[TimetableSlotOut]:
    return await timetable_service.list_slots(
        session, ctx.tenant_id, academic_year_id=academic_year_id
    )


@router.get("/timetable/my-day", response_model=TeacherDayOut)
async def my_day(
    on_date: dt.date | None = Query(default=None, alias="date"),
    ctx: TenantContext = Depends(_timetable),
    session: AsyncSession = Depends(get_session),
) -> TeacherDayOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await timetable_service.get_teacher_day(
        session,
        ctx.tenant_id,
        teacher_user_id=ctx.user_id,
        on_date=on_date or await school_today(session, ctx.tenant_id),
    )


@router.post("/timetable/slots", response_model=TimetableSlotOut, status_code=201)
async def create_slot(
    body: TimetableSlotCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_timetable),
    session: AsyncSession = Depends(get_session),
) -> TimetableSlotOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await timetable_service.create_slot(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="timetable.slot.created",
        resource_type="timetable_slot",
        resource_id=result.id,
        metadata={
            "day_of_week": result.day_of_week,
            "class_level": result.class_level,
            "subject_code": result.subject_code,
        },
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/timetable/import", response_model=TimetableImportResponse)
async def import_slots(
    body: TimetableImportRequest,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_timetable),
    session: AsyncSession = Depends(get_session),
) -> TimetableImportResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await timetable_service.import_slots(session, ctx.tenant_id, body)
    if not body.dry_run and result.created:
        await record_audit(
            session,
            actor_type=ActorType.tenant_user,
            actor_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            action="timetable.import",
            resource_type="timetable_slot",
            resource_id=None,
            metadata={"created": result.created, "failed": result.failed},
            ip_address=request.client.host if request.client else None,
        )
    if not body.dry_run:
        await session.commit()
    return result


@router.patch("/timetable/slots/{slot_id}", response_model=TimetableSlotOut)
async def update_slot(
    slot_id: UUID,
    body: TimetableSlotUpdate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_timetable),
    session: AsyncSession = Depends(get_session),
) -> TimetableSlotOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await timetable_service.update_slot(session, ctx.tenant_id, slot_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="timetable.slot.updated",
        resource_type="timetable_slot",
        resource_id=slot_id,
        metadata={"day_of_week": result.day_of_week},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete("/timetable/slots/{slot_id}", status_code=204, response_class=Response)
async def delete_slot(
    slot_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_timetable),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await timetable_service.delete_slot(session, ctx.tenant_id, slot_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="timetable.slot.deleted",
        resource_type="timetable_slot",
        resource_id=slot_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)

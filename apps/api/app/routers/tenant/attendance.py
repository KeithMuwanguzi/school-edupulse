"""Tenant attendance — Phase 2 §7 (`attendance` module gate)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.core.school_time import school_today
from app.models.enums import ActorType
from app.schemas.attendance import (
    AttendanceDailySummary,
    AttendanceMarkRequest,
    AttendanceMarkResponse,
    AttendanceRollOut,
    ClassAttendanceDayOut,
)
from app.services import attendance_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:attendance"])

_attendance = require_module("attendance")
_marker = require_role("teacher")


@router.get("/attendance/summary", response_model=AttendanceDailySummary)
async def daily_summary(
    on_date: dt.date | None = Query(default=None, alias="date"),
    ctx: TenantContext = Depends(_attendance),
    session: AsyncSession = Depends(get_session),
) -> AttendanceDailySummary:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await attendance_service.get_daily_summary(
        session, ctx.tenant_id, on_date=on_date or await school_today(session, ctx.tenant_id)
    )


@router.get("/attendance/roll", response_model=AttendanceRollOut)
async def roll_roster(
    class_id: UUID = Query(...),
    stream_id: UUID | None = Query(default=None),
    timetable_slot_id: UUID | None = Query(default=None),
    on_date: dt.date | None = Query(default=None, alias="date"),
    ctx: TenantContext = Depends(_attendance),
    session: AsyncSession = Depends(get_session),
) -> AttendanceRollOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await attendance_service.get_roll(
        session,
        ctx.tenant_id,
        class_id=class_id,
        stream_id=stream_id,
        on_date=on_date or await school_today(session, ctx.tenant_id),
        timetable_slot_id=timetable_slot_id,
    )


@router.get("/attendance/class-day", response_model=ClassAttendanceDayOut)
async def class_attendance_day(
    class_id: UUID = Query(...),
    stream_id: UUID | None = Query(default=None),
    on_date: dt.date | None = Query(default=None, alias="date"),
    ctx: TenantContext = Depends(_attendance),
    session: AsyncSession = Depends(get_session),
) -> ClassAttendanceDayOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await attendance_service.get_class_attendance_day(
        session,
        ctx.tenant_id,
        class_id=class_id,
        stream_id=stream_id,
        on_date=on_date or await school_today(session, ctx.tenant_id),
    )


@router.post("/attendance/mark", response_model=AttendanceMarkResponse)
async def mark_roll(
    body: AttendanceMarkRequest,
    request: Request,
    ctx: TenantContext = Depends(_marker),
    _mod: TenantContext = Depends(_attendance),
    session: AsyncSession = Depends(get_session),
) -> AttendanceMarkResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await attendance_service.mark_roll(
        session,
        ctx.tenant_id,
        marker_user_id=ctx.user_id,
        marker_role=ctx.role,
        body=body,
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="attendance.marked",
        resource_type="attendance",
        resource_id=None,
        metadata={
            "date": result.date.isoformat(),
            "class_id": str(body.class_id),
            "saved": result.saved,
            "present": result.present,
            "absent": result.absent,
        },
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result

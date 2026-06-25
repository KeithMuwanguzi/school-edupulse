"""Report cards — Phase 2 §10."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.schemas.reportcard import (
    ReportCardClassOption,
    ReportCardPreviewOut,
    ReportCardStudentOut,
)
from app.services import reportcard_service

router = APIRouter(prefix="/tenant", tags=["tenant:reportcards"])

_reportcards = require_module("reportcards")
_staff = require_role("school_admin", "deputy_head", "teacher")


@router.get("/reportcards/classes", response_model=list[ReportCardClassOption])
async def list_report_card_classes(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_reportcards),
    session: AsyncSession = Depends(get_session),
) -> list[ReportCardClassOption]:
    await apply_tenant_guc(session, ctx.tenant_id)
    options, _term = await reportcard_service.list_class_options(
        session, ctx.tenant_id, term_id=term_id
    )
    return options


@router.get("/reportcards/students", response_model=list[ReportCardStudentOut])
async def list_report_card_students(
    class_id: UUID = Query(...),
    stream_id: UUID | None = None,
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_reportcards),
    session: AsyncSession = Depends(get_session),
) -> list[ReportCardStudentOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    items, _term = await reportcard_service.list_students_for_class(
        session,
        ctx.tenant_id,
        class_id=class_id,
        stream_id=stream_id,
        term_id=term_id,
    )
    return items


@router.get("/reportcards/preview", response_model=ReportCardPreviewOut)
async def report_card_preview(
    student_id: UUID = Query(...),
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_reportcards),
    session: AsyncSession = Depends(get_session),
) -> ReportCardPreviewOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await reportcard_service.get_preview(
        session,
        ctx.tenant_id,
        student_id=student_id,
        term_id=term_id,
    )

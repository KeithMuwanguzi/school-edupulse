"""Assessment module — term sets, CA config, teacher mark entry (Phase 2 §9)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.schemas.assessment import (
    AssessmentSetCreate,
    AssessmentSetOut,
    AssessmentSetUpdate,
    AssessmentSummaryOut,
    ComputedCaOut,
    MarkEntryRosterOut,
    MarkEntrySaveRequest,
    MarkEntrySaveResponse,
    MarksGridOut,
    MarksImportRequest,
    MarksImportResponse,
    StudentPerformanceOut,
    TermCaConfigOut,
    TermCaConfigUpdate,
)
from app.services import assessment_service

router = APIRouter(prefix="/tenant", tags=["tenant:assessment"])

_assessment = require_module("assessment")
_admin = require_role("school_admin", "deputy_head")
_staff = require_role("school_admin", "deputy_head", "teacher")
_teacher = require_role("teacher")


@router.get("/assessment/summary", response_model=AssessmentSummaryOut)
async def assessment_summary(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> AssessmentSummaryOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await assessment_service.assessment_summary(
        session, ctx.tenant_id, term_id=term_id
    )


@router.get("/assessment/sets", response_model=list[AssessmentSetOut])
async def list_sets(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> list[AssessmentSetOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await assessment_service.list_sets(session, ctx.tenant_id, term_id=term_id)


@router.post("/assessment/sets", response_model=AssessmentSetOut, status_code=status.HTTP_201_CREATED)
async def create_set(
    body: AssessmentSetCreate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> AssessmentSetOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await assessment_service.create_set(session, ctx.tenant_id, body)
    await session.commit()
    return out


@router.patch("/assessment/sets/{set_id}", response_model=AssessmentSetOut)
async def update_set(
    set_id: UUID,
    body: AssessmentSetUpdate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> AssessmentSetOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await assessment_service.update_set(session, ctx.tenant_id, set_id, body)
    await session.commit()
    return out


@router.post("/assessment/sets/{set_id}/open", response_model=AssessmentSetOut)
async def open_set(
    set_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> AssessmentSetOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await assessment_service.open_set(session, ctx.tenant_id, set_id)
    await session.commit()
    return out


@router.post("/assessment/sets/{set_id}/close", response_model=AssessmentSetOut)
async def close_set(
    set_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> AssessmentSetOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await assessment_service.close_set(session, ctx.tenant_id, set_id)
    await session.commit()
    return out


@router.delete("/assessment/sets/{set_id}", status_code=204, response_class=Response)
async def delete_set(
    set_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await assessment_service.delete_set(session, ctx.tenant_id, set_id)
    await session.commit()
    return Response(status_code=204)


@router.get("/assessment/ca-config", response_model=TermCaConfigOut)
async def get_ca_config(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> TermCaConfigOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await assessment_service.get_ca_config(
        session, ctx.tenant_id, term_id=term_id
    )


@router.put("/assessment/ca-config", response_model=TermCaConfigOut)
async def update_ca_config(
    body: TermCaConfigUpdate,
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> TermCaConfigOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await assessment_service.update_ca_config(
        session, ctx.tenant_id, body, term_id=term_id
    )
    await session.commit()
    return out


@router.get("/assessment/entry/roster", response_model=MarkEntryRosterOut)
async def mark_entry_roster(
    set_id: UUID = Query(...),
    class_id: UUID = Query(...),
    subject_id: UUID = Query(...),
    stream_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> MarkEntryRosterOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await assessment_service.get_mark_entry_roster(
        session,
        ctx.tenant_id,
        set_id=set_id,
        class_id=class_id,
        subject_id=subject_id,
        stream_id=stream_id,
        user_id=ctx.user_id,
        role=ctx.role,
    )


@router.put("/assessment/entry/marks", response_model=MarkEntrySaveResponse)
async def save_marks(
    body: MarkEntrySaveRequest,
    ctx: TenantContext = Depends(_teacher),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> MarkEntrySaveResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await assessment_service.save_marks(
        session,
        ctx.tenant_id,
        user_id=ctx.user_id,
        role=ctx.role,
        body=body,
    )
    await session.commit()
    return out


@router.put("/assessment/entry/import", response_model=MarksImportResponse)
async def import_marks(
    body: MarksImportRequest,
    ctx: TenantContext = Depends(_teacher),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> MarksImportResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await assessment_service.import_marks(
        session,
        ctx.tenant_id,
        user_id=ctx.user_id,
        role=ctx.role,
        body=body,
    )
    if not body.dry_run:
        await session.commit()
    return out


@router.get("/assessment/marks-grid", response_model=MarksGridOut)
async def marks_grid(
    set_id: UUID = Query(...),
    class_id: UUID = Query(...),
    stream_id: UUID | None = Query(default=None),
    term_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> MarksGridOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await assessment_service.get_marks_grid(
        session,
        ctx.tenant_id,
        set_id=set_id,
        class_id=class_id,
        stream_id=stream_id,
        term_id=term_id,
    )


@router.get("/assessment/student-performance", response_model=StudentPerformanceOut)
async def student_performance(
    student_id: UUID = Query(...),
    term_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> StudentPerformanceOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await assessment_service.student_performance(
        session,
        ctx.tenant_id,
        student_id=student_id,
        term_id=term_id,
    )


@router.get("/assessment/computed-ca", response_model=ComputedCaOut)
async def computed_ca(
    class_id: UUID = Query(...),
    stream_id: UUID | None = Query(default=None),
    term_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> ComputedCaOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await assessment_service.compute_class_ca(
        session,
        ctx.tenant_id,
        class_id=class_id,
        stream_id=stream_id,
        term_id=term_id,
    )

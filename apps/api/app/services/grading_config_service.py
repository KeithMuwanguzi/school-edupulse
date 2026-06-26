"""Grading scales per NCDC section — subjects share or override scales."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.models.enums import NcdcCycle
from app.models.grading import AggregateDivision, GradeRange, GradingScale, SubjectGradingAssignment
from app.models.subject import Subject
from app.schemas.grading import (
    AggregateDivisionCreate,
    AggregateDivisionOut,
    AggregateDivisionUpdate,
    CYCLE_SECTIONS,
    CycleGradingSectionOut,
    GradeRangeCreate,
    GradeRangeOut,
    GradeRangeUpdate,
    GradingConfigOut,
    GradingScaleCreate,
    GradingScaleOut,
    GradingScaleUpdate,
    SubjectGradingOut,
    SubjectGradingScaleUpdate,
)

PRIMARY_CYCLES = (NcdcCycle.cycle_1, NcdcCycle.cycle_2, NcdcCycle.cycle_3)


def _subject_in_cycle(subject: Subject, cycle: NcdcCycle) -> bool:
    for entry in subject.ncdc_cycles:
        if entry == cycle:
            return True
        if isinstance(entry, str) and entry == cycle.value:
            return True
    return False


def _subject_in_primary(subject: Subject) -> bool:
    return any(_subject_in_cycle(subject, cycle) for cycle in PRIMARY_CYCLES)


def _subject_row(
    subject: Subject,
    scale_by_id: dict[UUID, GradingScale],
    *,
    in_section: bool,
    grading_scale_id: UUID | None = None,
) -> SubjectGradingOut:
    scale_name = None
    if grading_scale_id and grading_scale_id in scale_by_id:
        scale_name = scale_by_id[grading_scale_id].name
    return SubjectGradingOut(
        subject_id=subject.id,
        subject_code=subject.code,
        subject_name=subject.name,
        ncdc_cycles=[c.value for c in subject.ncdc_cycles],
        grading_scale_id=grading_scale_id,
        grading_scale_name=scale_name,
        in_section=in_section,
    )


async def _load_assignments(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    cycle: NcdcCycle | None = None,
) -> dict[tuple[UUID, NcdcCycle], UUID]:
    q = select(SubjectGradingAssignment).where(
        SubjectGradingAssignment.tenant_id == tenant_id,
    )
    if cycle is not None:
        q = q.where(SubjectGradingAssignment.ncdc_cycle == cycle)
    rows = list(await session.scalars(q))
    return {(r.subject_id, r.ncdc_cycle): r.grading_scale_id for r in rows}


async def scale_id_for_subject_cycle(
    session: AsyncSession,
    tenant_id: UUID,
    subject_id: UUID,
    cycle: NcdcCycle,
) -> UUID | None:
    return await session.scalar(
        select(SubjectGradingAssignment.grading_scale_id).where(
            SubjectGradingAssignment.tenant_id == tenant_id,
            SubjectGradingAssignment.subject_id == subject_id,
            SubjectGradingAssignment.ncdc_cycle == cycle,
        )
    )


def _strip_comment(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def _range_out(row: GradeRange) -> GradeRangeOut:
    return GradeRangeOut(
        id=row.id,
        scale_id=row.scale_id,
        label=row.label,
        aggregate_weight=row.aggregate_weight,
        min_mark=row.min_mark,
        max_mark=row.max_mark,
        comment=row.comment,
        sort_order=row.sort_order,
        is_active=row.is_active,
    )


def _division_out(row: AggregateDivision) -> AggregateDivisionOut:
    return AggregateDivisionOut(
        id=row.id,
        label=row.label,
        min_aggregate=row.min_aggregate,
        max_aggregate=row.max_aggregate,
        class_teacher_comment=row.class_teacher_comment,
        head_teacher_comment=row.head_teacher_comment,
        sort_order=row.sort_order,
        is_active=row.is_active,
    )


async def _load_scale(
    session: AsyncSession, tenant_id: UUID, scale_id: UUID
) -> GradingScale:
    scale = await session.scalar(
        select(GradingScale).where(
            GradingScale.tenant_id == tenant_id,
            GradingScale.id == scale_id,
            GradingScale.deleted_at.is_(None),
        )
    )
    if scale is None:
        raise NotFoundError("Grading scale not found.")
    return scale


async def _load_range(
    session: AsyncSession, tenant_id: UUID, scale_id: UUID, range_id: UUID
) -> GradeRange:
    row = await session.scalar(
        select(GradeRange).where(
            GradeRange.tenant_id == tenant_id,
            GradeRange.scale_id == scale_id,
            GradeRange.id == range_id,
            GradeRange.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Grade range not found.")
    return row


async def _scale_out(
    session: AsyncSession,
    tenant_id: UUID,
    scale: GradingScale,
    *,
    subject_counts: dict[UUID, int],
) -> GradingScaleOut:
    ranges = list(
        await session.scalars(
            select(GradeRange)
            .where(
                GradeRange.tenant_id == tenant_id,
                GradeRange.scale_id == scale.id,
                GradeRange.deleted_at.is_(None),
            )
            .order_by(GradeRange.sort_order, GradeRange.aggregate_weight)
        )
    )
    return GradingScaleOut(
        id=scale.id,
        name=scale.name,
        ncdc_cycle=scale.ncdc_cycle.value,
        description=scale.description,
        sort_order=scale.sort_order,
        ranges=[_range_out(r) for r in ranges],
        subject_count=subject_counts.get(scale.id, 0),
    )


async def get_config(session: AsyncSession, tenant_id: UUID) -> GradingConfigOut:
    subjects = list(
        await session.scalars(
            select(Subject)
            .where(
                Subject.tenant_id == tenant_id,
                Subject.deleted_at.is_(None),
                Subject.is_active.is_(True),
            )
            .order_by(Subject.sort_order, Subject.code)
        )
    )
    scales = list(
        await session.scalars(
            select(GradingScale)
            .where(
                GradingScale.tenant_id == tenant_id,
                GradingScale.deleted_at.is_(None),
            )
            .order_by(GradingScale.ncdc_cycle, GradingScale.sort_order, GradingScale.name)
        )
    )

    scale_by_id = {s.id: s for s in scales}
    assignments = await _load_assignments(session, tenant_id)
    subject_counts: dict[UUID, int] = {}
    for (_, _cycle), scale_id in assignments.items():
        subject_counts[scale_id] = subject_counts.get(scale_id, 0) + 1

    divisions = list(
        await session.scalars(
            select(AggregateDivision)
            .where(
                AggregateDivision.tenant_id == tenant_id,
                AggregateDivision.deleted_at.is_(None),
            )
            .order_by(AggregateDivision.sort_order, AggregateDivision.min_aggregate)
        )
    )

    sections: list[CycleGradingSectionOut] = []
    for cycle, label in CYCLE_SECTIONS:
        cycle_scales = [s for s in scales if s.ncdc_cycle == cycle]
        cycle_subjects = [s for s in subjects if _subject_in_cycle(s, cycle)]
        extendable: list[Subject] = []
        if cycle in PRIMARY_CYCLES:
            extendable = [
                s
                for s in subjects
                if not _subject_in_cycle(s, cycle) and _subject_in_primary(s)
            ]

        subject_rows = [
            _subject_row(
                subject,
                scale_by_id,
                in_section=True,
                grading_scale_id=assignments.get((subject.id, cycle)),
            )
            for subject in cycle_subjects
        ]
        extendable_rows = [
            _subject_row(subject, scale_by_id, in_section=False, grading_scale_id=None)
            for subject in extendable
        ]

        cycle_subject_counts = {
            scale_id: sum(
                1
                for (sid, cyc), sid_scale in assignments.items()
                if cyc == cycle and sid_scale == scale_id
            )
            for scale_id in {s.id for s in cycle_scales}
        }
        scale_rows = [
            await _scale_out(
                session, tenant_id, scale, subject_counts=cycle_subject_counts
            )
            for scale in cycle_scales
        ]
        sections.append(
            CycleGradingSectionOut(
                cycle=cycle.value,
                cycle_label=label,
                scales=scale_rows,
                subjects=subject_rows,
                extendable_subjects=extendable_rows,
            )
        )

    return GradingConfigOut(
        sections=sections,
        aggregate_divisions=[_division_out(d) for d in divisions],
    )


async def create_scale(
    session: AsyncSession, tenant_id: UUID, body: GradingScaleCreate
) -> GradingScaleOut:
    cycle = NcdcCycle(body.ncdc_cycle)
    max_order = await session.scalar(
        select(func.coalesce(func.max(GradingScale.sort_order), -1)).where(
            GradingScale.tenant_id == tenant_id,
            GradingScale.ncdc_cycle == cycle,
            GradingScale.deleted_at.is_(None),
        )
    )
    row = GradingScale(
        tenant_id=tenant_id,
        name=body.name.strip(),
        ncdc_cycle=cycle,
        description=body.description,
        sort_order=body.sort_order if body.sort_order is not None else int(max_order) + 1,
    )
    session.add(row)
    await session.flush()
    return await _scale_out(session, tenant_id, row, subject_counts={})


async def update_scale(
    session: AsyncSession, tenant_id: UUID, scale_id: UUID, body: GradingScaleUpdate
) -> GradingScaleOut:
    row = await _load_scale(session, tenant_id, scale_id)
    if body.name is not None:
        row.name = body.name.strip()
    if body.description is not None:
        row.description = body.description
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    row.updated_at = dt.datetime.now(dt.UTC)
    await session.flush()

    count = int(
        await session.scalar(
            select(func.count())
            .select_from(SubjectGradingAssignment)
            .where(
                SubjectGradingAssignment.tenant_id == tenant_id,
                SubjectGradingAssignment.grading_scale_id == scale_id,
            )
        )
        or 0
    )
    return await _scale_out(session, tenant_id, row, subject_counts={scale_id: count})


async def delete_scale(session: AsyncSession, tenant_id: UUID, scale_id: UUID) -> None:
    row = await _load_scale(session, tenant_id, scale_id)
    assigned = int(
        await session.scalar(
            select(func.count())
            .select_from(SubjectGradingAssignment)
            .where(
                SubjectGradingAssignment.tenant_id == tenant_id,
                SubjectGradingAssignment.grading_scale_id == scale_id,
            )
        )
        or 0
    )
    if assigned:
        raise ValidationError(
            "Cannot delete a scale that is assigned to subjects. Reassign them first."
        )
    row.deleted_at = dt.datetime.now(dt.UTC)
    ranges = list(
        await session.scalars(
            select(GradeRange).where(
                GradeRange.tenant_id == tenant_id,
                GradeRange.scale_id == scale_id,
                GradeRange.deleted_at.is_(None),
            )
        )
    )
    now = dt.datetime.now(dt.UTC)
    for gr in ranges:
        gr.deleted_at = now
    await session.flush()


async def create_range(
    session: AsyncSession, tenant_id: UUID, scale_id: UUID, body: GradeRangeCreate
) -> GradeRangeOut:
    await _load_scale(session, tenant_id, scale_id)
    max_order = await session.scalar(
        select(func.coalesce(func.max(GradeRange.sort_order), -1)).where(
            GradeRange.tenant_id == tenant_id,
            GradeRange.scale_id == scale_id,
            GradeRange.deleted_at.is_(None),
        )
    )
    row = GradeRange(
        tenant_id=tenant_id,
        scale_id=scale_id,
        label=body.label.strip(),
        aggregate_weight=body.aggregate_weight,
        min_mark=body.min_mark,
        max_mark=body.max_mark,
        comment=_strip_comment(body.comment),
        sort_order=body.sort_order if body.sort_order is not None else int(max_order) + 1,
    )
    session.add(row)
    await session.flush()
    return _range_out(row)


async def update_range(
    session: AsyncSession,
    tenant_id: UUID,
    scale_id: UUID,
    range_id: UUID,
    body: GradeRangeUpdate,
) -> GradeRangeOut:
    row = await _load_range(session, tenant_id, scale_id, range_id)
    min_mark = body.min_mark if body.min_mark is not None else row.min_mark
    max_mark = body.max_mark if body.max_mark is not None else row.max_mark
    if max_mark < min_mark:
        raise ValidationError("max_mark must be >= min_mark.")

    if body.label is not None:
        row.label = body.label.strip()
    if body.aggregate_weight is not None:
        row.aggregate_weight = body.aggregate_weight
    if body.min_mark is not None:
        row.min_mark = body.min_mark
    if body.max_mark is not None:
        row.max_mark = body.max_mark
    if body.comment is not None:
        row.comment = _strip_comment(body.comment)
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.is_active is not None:
        row.is_active = body.is_active
    row.updated_at = dt.datetime.now(dt.UTC)
    await session.flush()
    return _range_out(row)


async def delete_range(
    session: AsyncSession, tenant_id: UUID, scale_id: UUID, range_id: UUID
) -> None:
    row = await _load_range(session, tenant_id, scale_id, range_id)
    row.deleted_at = dt.datetime.now(dt.UTC)
    await session.flush()


async def assign_subject_scale(
    session: AsyncSession,
    tenant_id: UUID,
    subject_id: UUID,
    body: SubjectGradingScaleUpdate,
) -> SubjectGradingOut:
    subject = await session.scalar(
        select(Subject).where(
            Subject.tenant_id == tenant_id,
            Subject.id == subject_id,
            Subject.deleted_at.is_(None),
        )
    )
    if subject is None:
        raise NotFoundError("Subject not found.")

    cycle = NcdcCycle(body.ncdc_cycle)
    if not _subject_in_cycle(subject, cycle):
        raise ValidationError(
            f"This subject is not in {cycle.value.replace('_', ' ')}. "
            f"Add it under Settings → Subjects first."
        )

    existing = await session.scalar(
        select(SubjectGradingAssignment).where(
            SubjectGradingAssignment.tenant_id == tenant_id,
            SubjectGradingAssignment.subject_id == subject_id,
            SubjectGradingAssignment.ncdc_cycle == cycle,
        )
    )

    scale_by_id: dict[UUID, GradingScale] = {}
    assigned_scale_id: UUID | None = None

    if body.grading_scale_id is None:
        if existing is not None:
            await session.delete(existing)
            await session.flush()
    else:
        scale = await _load_scale(session, tenant_id, body.grading_scale_id)
        if scale.ncdc_cycle != cycle:
            raise ValidationError(
                f"Scale '{scale.name}' is for {scale.ncdc_cycle.value.replace('_', ' ')}, "
                f"not {cycle.value.replace('_', ' ')}."
            )
        scale_by_id = {scale.id: scale}
        assigned_scale_id = scale.id

        if existing is not None:
            existing.grading_scale_id = scale.id
            existing.updated_at = dt.datetime.now(dt.UTC)
        else:
            session.add(
                SubjectGradingAssignment(
                    tenant_id=tenant_id,
                    subject_id=subject_id,
                    ncdc_cycle=cycle,
                    grading_scale_id=scale.id,
                )
            )
        await session.flush()

    return _subject_row(
        subject,
        scale_by_id,
        in_section=True,
        grading_scale_id=assigned_scale_id,
    )


async def create_aggregate_division(
    session: AsyncSession, tenant_id: UUID, body: AggregateDivisionCreate
) -> AggregateDivisionOut:
    if body.max_aggregate < body.min_aggregate:
        raise ValidationError("max_aggregate must be >= min_aggregate.")

    max_order = await session.scalar(
        select(func.coalesce(func.max(AggregateDivision.sort_order), -1)).where(
            AggregateDivision.tenant_id == tenant_id,
            AggregateDivision.deleted_at.is_(None),
        )
    )
    row = AggregateDivision(
        tenant_id=tenant_id,
        label=body.label.strip(),
        min_aggregate=body.min_aggregate,
        max_aggregate=body.max_aggregate,
        class_teacher_comment=_strip_comment(body.class_teacher_comment),
        head_teacher_comment=_strip_comment(body.head_teacher_comment),
        sort_order=body.sort_order if body.sort_order is not None else int(max_order) + 1,
    )
    session.add(row)
    await session.flush()
    return _division_out(row)


async def update_aggregate_division(
    session: AsyncSession, tenant_id: UUID, division_id: UUID, body: AggregateDivisionUpdate
) -> AggregateDivisionOut:
    row = await session.scalar(
        select(AggregateDivision).where(
            AggregateDivision.tenant_id == tenant_id,
            AggregateDivision.id == division_id,
            AggregateDivision.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Aggregate division not found.")

    min_agg = body.min_aggregate if body.min_aggregate is not None else row.min_aggregate
    max_agg = body.max_aggregate if body.max_aggregate is not None else row.max_aggregate
    if max_agg < min_agg:
        raise ValidationError("max_aggregate must be >= min_aggregate.")

    if body.label is not None:
        row.label = body.label.strip()
    if body.min_aggregate is not None:
        row.min_aggregate = body.min_aggregate
    if body.max_aggregate is not None:
        row.max_aggregate = body.max_aggregate
    if body.class_teacher_comment is not None:
        row.class_teacher_comment = _strip_comment(body.class_teacher_comment)
    if body.head_teacher_comment is not None:
        row.head_teacher_comment = _strip_comment(body.head_teacher_comment)
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.is_active is not None:
        row.is_active = body.is_active
    row.updated_at = dt.datetime.now(dt.UTC)
    await session.flush()
    return _division_out(row)


async def delete_aggregate_division(
    session: AsyncSession, tenant_id: UUID, division_id: UUID
) -> None:
    row = await session.scalar(
        select(AggregateDivision).where(
            AggregateDivision.tenant_id == tenant_id,
            AggregateDivision.id == division_id,
            AggregateDivision.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Aggregate division not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)
    await session.flush()

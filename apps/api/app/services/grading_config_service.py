"""Grading scales per NCDC section — subjects share or override scales."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.models.enums import NcdcCycle
from app.models.grading import AggregateDivision, GradeRange, GradingScale
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
        class_teacher_comment=row.class_teacher_comment,
        head_teacher_comment=row.head_teacher_comment,
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
    subject_counts: dict[UUID, int] = {}
    for subject in subjects:
        if subject.grading_scale_id:
            subject_counts[subject.grading_scale_id] = (
                subject_counts.get(subject.grading_scale_id, 0) + 1
            )

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
        cycle_subjects = [s for s in subjects if cycle in s.ncdc_cycles]

        subject_rows: list[SubjectGradingOut] = []
        for subject in cycle_subjects:
            scale_name = None
            if subject.grading_scale_id and subject.grading_scale_id in scale_by_id:
                scale_name = scale_by_id[subject.grading_scale_id].name
            subject_rows.append(
                SubjectGradingOut(
                    subject_id=subject.id,
                    subject_code=subject.code,
                    subject_name=subject.name,
                    ncdc_cycles=[c.value for c in subject.ncdc_cycles],
                    grading_scale_id=subject.grading_scale_id,
                    grading_scale_name=scale_name,
                )
            )

        scale_rows = [
            await _scale_out(session, tenant_id, scale, subject_counts=subject_counts)
            for scale in cycle_scales
        ]
        sections.append(
            CycleGradingSectionOut(
                cycle=cycle.value,
                cycle_label=label,
                scales=scale_rows,
                subjects=subject_rows,
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
            .select_from(Subject)
            .where(
                Subject.tenant_id == tenant_id,
                Subject.grading_scale_id == scale_id,
                Subject.deleted_at.is_(None),
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
            .select_from(Subject)
            .where(
                Subject.tenant_id == tenant_id,
                Subject.grading_scale_id == scale_id,
                Subject.deleted_at.is_(None),
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
        class_teacher_comment=_strip_comment(body.class_teacher_comment),
        head_teacher_comment=_strip_comment(body.head_teacher_comment),
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

    scale_name = None
    if body.grading_scale_id is not None:
        scale = await _load_scale(session, tenant_id, body.grading_scale_id)
        if scale.ncdc_cycle not in subject.ncdc_cycles:
            raise ValidationError(
                f"Scale '{scale.name}' is for {scale.ncdc_cycle.value}, "
                f"but this subject is not in that section."
            )
        scale_name = scale.name

    subject.grading_scale_id = body.grading_scale_id
    subject.updated_at = dt.datetime.now(dt.UTC)
    await session.flush()

    return SubjectGradingOut(
        subject_id=subject.id,
        subject_code=subject.code,
        subject_name=subject.name,
        ncdc_cycles=[c.value for c in subject.ncdc_cycles],
        grading_scale_id=subject.grading_scale_id,
        grading_scale_name=scale_name,
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

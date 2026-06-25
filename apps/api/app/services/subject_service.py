"""Subject catalogue — Phase 2 §2."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models.subject import Subject
from app.schemas.subject import (
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
    default_is_core,
    sort_cycles,
)


def _out(row: Subject) -> SubjectOut:
    cycles = sort_cycles(list(row.ncdc_cycles))
    values = [c.value for c in cycles]
    return SubjectOut(
        id=row.id,
        code=row.code,
        name=row.name,
        ncdc_cycles=values,
        ncdc_cycle=values[0],
        is_active=row.is_active,
        is_core=row.is_core,
        sort_order=row.sort_order,
    )


async def list_subjects(session: AsyncSession, tenant_id: UUID) -> list[SubjectOut]:
    rows = await session.scalars(
        select(Subject)
        .where(Subject.tenant_id == tenant_id, Subject.deleted_at.is_(None))
        .order_by(Subject.sort_order, Subject.name)
    )
    return [_out(r) for r in rows]


async def create_subject(
    session: AsyncSession, tenant_id: UUID, body: SubjectCreate
) -> tuple[SubjectOut, bool]:
    """Create a subject or extend cycles on an existing code. Returns (subject, created_new)."""
    assert body.ncdc_cycles is not None
    existing = await session.scalar(
        select(Subject).where(
            Subject.tenant_id == tenant_id,
            Subject.code == body.code,
            Subject.deleted_at.is_(None),
        )
    )
    if existing:
        merged = sort_cycles(list(set(existing.ncdc_cycles) | set(body.ncdc_cycles)))
        existing.ncdc_cycles = merged
        await session.flush()
        return _out(existing), False

    row = Subject(
        tenant_id=tenant_id,
        code=body.code,
        name=body.name.strip(),
        ncdc_cycles=body.ncdc_cycles,
        is_active=True,
        is_core=body.is_core if body.is_core is not None else default_is_core(body.code),
        sort_order=body.sort_order,
    )
    session.add(row)
    await session.flush()
    return _out(row), True


async def update_subject(
    session: AsyncSession, tenant_id: UUID, subject_id: UUID, body: SubjectUpdate
) -> SubjectOut:
    row = await session.scalar(
        select(Subject).where(
            Subject.id == subject_id,
            Subject.tenant_id == tenant_id,
            Subject.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Subject not found.")

    if body.name is not None:
        row.name = body.name.strip()
    if body.ncdc_cycles is not None:
        row.ncdc_cycles = body.ncdc_cycles
    if body.is_active is not None:
        row.is_active = body.is_active
    if body.is_core is not None:
        row.is_core = body.is_core
    if body.sort_order is not None:
        row.sort_order = body.sort_order

    return _out(row)


async def delete_subject(
    session: AsyncSession, tenant_id: UUID, subject_id: UUID
) -> None:
    row = await session.scalar(
        select(Subject).where(
            Subject.id == subject_id,
            Subject.tenant_id == tenant_id,
            Subject.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Subject not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)
    row.is_active = False

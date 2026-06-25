"""Classes & streams — Phase 2 §3."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.enums import ClassLevel
from app.models.school_class import ClassStream, SchoolClass
from app.schemas.school_class import (
    ClassCreate,
    ClassOut,
    ClassUpdate,
    StreamCreate,
    StreamOut,
    StreamUpdate,
)

LEVEL_LABELS: dict[ClassLevel, str] = {
    ClassLevel.P1: "Primary One",
    ClassLevel.P2: "Primary Two",
    ClassLevel.P3: "Primary Three",
    ClassLevel.P4: "Primary Four",
    ClassLevel.P5: "Primary Five",
    ClassLevel.P6: "Primary Six",
    ClassLevel.P7: "Primary Seven",
}

LEVEL_ORDER: dict[ClassLevel, int] = {
    ClassLevel.P1: 1,
    ClassLevel.P2: 2,
    ClassLevel.P3: 3,
    ClassLevel.P4: 4,
    ClassLevel.P5: 5,
    ClassLevel.P6: 6,
    ClassLevel.P7: 7,
}


def _stream_out(row: ClassStream) -> StreamOut:
    return StreamOut(
        id=row.id,
        name=row.name,
        is_active=row.is_active,
        sort_order=row.sort_order,
    )


def _class_out(row: SchoolClass) -> ClassOut:
    streams = [s for s in row.streams if s.deleted_at is None]
    return ClassOut(
        id=row.id,
        level=row.level.value,
        label=row.label,
        is_active=row.is_active,
        sort_order=row.sort_order,
        streams=[_stream_out(s) for s in streams],
    )


async def list_classes(session: AsyncSession, tenant_id: UUID) -> list[ClassOut]:
    rows = await session.scalars(
        select(SchoolClass)
        .where(SchoolClass.tenant_id == tenant_id, SchoolClass.deleted_at.is_(None))
        .options(selectinload(SchoolClass.streams))
        .order_by(SchoolClass.sort_order, SchoolClass.level)
    )
    return [_class_out(r) for r in rows]


async def create_class(
    session: AsyncSession, tenant_id: UUID, body: ClassCreate
) -> ClassOut:
    existing = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.level == body.level,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if existing:
        raise ConflictError(f"Class level {body.level.value} already exists.")

    label = (body.label or LEVEL_LABELS[body.level]).strip()
    sort_order = body.sort_order if body.sort_order is not None else LEVEL_ORDER[body.level]

    row = SchoolClass(
        tenant_id=tenant_id,
        level=body.level,
        label=label,
        is_active=True,
        sort_order=sort_order,
    )
    session.add(row)
    await session.flush()
    await session.refresh(row, ["streams"])
    return _class_out(row)


async def setup_primary_classes(session: AsyncSession, tenant_id: UUID) -> list[ClassOut]:
    created: list[ClassOut] = []
    for level in ClassLevel:
        exists = await session.scalar(
            select(SchoolClass.id).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.level == level,
                SchoolClass.deleted_at.is_(None),
            )
        )
        if exists:
            continue
        row = SchoolClass(
            tenant_id=tenant_id,
            level=level,
            label=LEVEL_LABELS[level],
            is_active=True,
            sort_order=LEVEL_ORDER[level],
        )
        session.add(row)
        await session.flush()
        created.append(
            ClassOut(
                id=row.id,
                level=row.level.value,
                label=row.label,
                is_active=row.is_active,
                sort_order=row.sort_order,
                streams=[],
            )
        )
    if not created:
        raise ValidationError("All P1–P7 classes already exist.")
    return created


async def update_class(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, body: ClassUpdate
) -> ClassOut:
    row = await session.scalar(
        select(SchoolClass)
        .where(
            SchoolClass.id == class_id,
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.deleted_at.is_(None),
        )
        .options(selectinload(SchoolClass.streams))
    )
    if row is None:
        raise NotFoundError("Class not found.")

    if body.label is not None:
        row.label = body.label.strip()
    if body.is_active is not None:
        row.is_active = body.is_active
    if body.sort_order is not None:
        row.sort_order = body.sort_order

    return _class_out(row)


async def delete_class(session: AsyncSession, tenant_id: UUID, class_id: UUID) -> None:
    row = await session.scalar(
        select(SchoolClass)
        .where(
            SchoolClass.id == class_id,
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.deleted_at.is_(None),
        )
        .options(selectinload(SchoolClass.streams))
    )
    if row is None:
        raise NotFoundError("Class not found.")
    now = dt.datetime.now(dt.UTC)
    row.deleted_at = now
    row.is_active = False
    for stream in row.streams:
        if stream.deleted_at is None:
            stream.deleted_at = now
            stream.is_active = False


async def _get_class(
    session: AsyncSession, tenant_id: UUID, class_id: UUID
) -> SchoolClass:
    row = await session.scalar(
        select(SchoolClass)
        .where(
            SchoolClass.id == class_id,
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.deleted_at.is_(None),
        )
        .options(selectinload(SchoolClass.streams))
    )
    if row is None:
        raise NotFoundError("Class not found.")
    return row


async def create_stream(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, body: StreamCreate
) -> ClassOut:
    school_class = await _get_class(session, tenant_id, class_id)
    name = body.name.strip()
    existing = await session.scalar(
        select(ClassStream).where(
            ClassStream.tenant_id == tenant_id,
            ClassStream.class_id == class_id,
            ClassStream.name == name,
            ClassStream.deleted_at.is_(None),
        )
    )
    if existing:
        raise ConflictError(f"Stream '{name}' already exists for this class.")

    stream = ClassStream(
        tenant_id=tenant_id,
        class_id=class_id,
        name=name,
        is_active=True,
        sort_order=body.sort_order,
    )
    session.add(stream)
    await session.flush()
    await session.refresh(school_class, ["streams"])
    return _class_out(school_class)


async def update_stream(
    session: AsyncSession,
    tenant_id: UUID,
    class_id: UUID,
    stream_id: UUID,
    body: StreamUpdate,
) -> ClassOut:
    school_class = await _get_class(session, tenant_id, class_id)
    stream = await session.scalar(
        select(ClassStream).where(
            ClassStream.id == stream_id,
            ClassStream.tenant_id == tenant_id,
            ClassStream.class_id == class_id,
            ClassStream.deleted_at.is_(None),
        )
    )
    if stream is None:
        raise NotFoundError("Stream not found.")

    if body.name is not None and body.name.strip() != stream.name:
        dup = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.class_id == class_id,
                ClassStream.name == body.name.strip(),
                ClassStream.deleted_at.is_(None),
                ClassStream.id != stream_id,
            )
        )
        if dup:
            raise ConflictError(f"Stream '{body.name.strip()}' already exists for this class.")
        stream.name = body.name.strip()
    if body.is_active is not None:
        stream.is_active = body.is_active
    if body.sort_order is not None:
        stream.sort_order = body.sort_order

    return _class_out(school_class)


async def delete_stream(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, stream_id: UUID
) -> ClassOut:
    school_class = await _get_class(session, tenant_id, class_id)
    stream = await session.scalar(
        select(ClassStream).where(
            ClassStream.id == stream_id,
            ClassStream.tenant_id == tenant_id,
            ClassStream.class_id == class_id,
            ClassStream.deleted_at.is_(None),
        )
    )
    if stream is None:
        raise NotFoundError("Stream not found.")
    stream.deleted_at = dt.datetime.now(dt.UTC)
    stream.is_active = False
    return _class_out(school_class)

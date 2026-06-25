"""Boarding & Hostel add-on — Phase 2 §19.

Hostels (boarding houses) hold rooms (dorms). Learners are allocated by setting
``students.hostel_id`` / ``students.hostel_room_id``. Occupancy is always
derived from active, non-deleted students so it can never drift from reality.
"""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.hostel import Hostel, HostelRoom
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.models.user import TenantUser
from app.schemas.hostel import (
    AllocateRequest,
    HostelCreate,
    HostelDetailOut,
    HostelOptionOut,
    HostelOut,
    HostelResidentOut,
    HostelRoomCreate,
    HostelRoomOptionOut,
    HostelRoomOut,
    HostelRoomUpdate,
    HostelUpdate,
)


# --- Occupancy helpers -----------------------------------------------------


async def _occupancy_by_hostel(session: AsyncSession, tenant_id: UUID) -> dict[UUID, int]:
    rows = await session.execute(
        select(Student.hostel_id, func.count())
        .where(
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
            Student.is_active.is_(True),
            Student.hostel_id.is_not(None),
        )
        .group_by(Student.hostel_id)
    )
    return {hostel_id: int(count) for hostel_id, count in rows.all()}


async def _occupancy_by_room(session: AsyncSession, tenant_id: UUID) -> dict[UUID, int]:
    rows = await session.execute(
        select(Student.hostel_room_id, func.count())
        .where(
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
            Student.is_active.is_(True),
            Student.hostel_room_id.is_not(None),
        )
        .group_by(Student.hostel_room_id)
    )
    return {room_id: int(count) for room_id, count in rows.all()}


async def _room_capacity_sums(session: AsyncSession, tenant_id: UUID) -> dict[UUID, int]:
    rows = await session.execute(
        select(HostelRoom.hostel_id, func.coalesce(func.sum(HostelRoom.capacity), 0))
        .where(
            HostelRoom.tenant_id == tenant_id,
            HostelRoom.deleted_at.is_(None),
        )
        .group_by(HostelRoom.hostel_id)
    )
    return {hostel_id: int(total) for hostel_id, total in rows.all()}


async def _room_counts(session: AsyncSession, tenant_id: UUID) -> dict[UUID, int]:
    rows = await session.execute(
        select(HostelRoom.hostel_id, func.count())
        .where(
            HostelRoom.tenant_id == tenant_id,
            HostelRoom.deleted_at.is_(None),
        )
        .group_by(HostelRoom.hostel_id)
    )
    return {hostel_id: int(count) for hostel_id, count in rows.all()}


def _effective_capacity(hostel: Hostel, room_capacity_sum: int) -> int | None:
    if hostel.capacity is not None:
        return hostel.capacity
    if room_capacity_sum > 0:
        return room_capacity_sum
    return None


def _pct(occupied: int, capacity: int | None) -> int:
    if not capacity or capacity <= 0:
        return 0
    return min(100, round(occupied / capacity * 100))


async def _warden_names(
    session: AsyncSession, tenant_id: UUID, ids: set[UUID]
) -> dict[UUID, str]:
    ids = {i for i in ids if i is not None}
    if not ids:
        return {}
    rows = await session.execute(
        select(TenantUser.id, TenantUser.name).where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.id.in_(ids),
        )
    )
    return {uid: name for uid, name in rows.all()}


def _hostel_out(
    hostel: Hostel,
    *,
    occupied: int,
    room_capacity_sum: int,
    room_count: int,
    warden_name: str | None,
) -> HostelOut:
    effective = _effective_capacity(hostel, room_capacity_sum)
    available = None if effective is None else max(0, effective - occupied)
    return HostelOut(
        id=hostel.id,
        name=hostel.name,
        code=hostel.code,
        gender=hostel.gender,
        capacity=hostel.capacity,
        warden_user_id=hostel.warden_user_id,
        warden_name=warden_name,
        location=hostel.location,
        notes=hostel.notes,
        is_active=hostel.is_active,
        sort_order=hostel.sort_order,
        room_count=room_count,
        effective_capacity=effective,
        occupied=occupied,
        available=available,
        occupancy_pct=_pct(occupied, effective),
    )


# --- Lookups ---------------------------------------------------------------


async def _get_hostel(session: AsyncSession, tenant_id: UUID, hostel_id: UUID) -> Hostel:
    row = await session.scalar(
        select(Hostel).where(
            Hostel.tenant_id == tenant_id,
            Hostel.id == hostel_id,
            Hostel.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Hostel not found.")
    return row


async def _get_room(
    session: AsyncSession, tenant_id: UUID, hostel_id: UUID, room_id: UUID
) -> HostelRoom:
    row = await session.scalar(
        select(HostelRoom).where(
            HostelRoom.tenant_id == tenant_id,
            HostelRoom.id == room_id,
            HostelRoom.hostel_id == hostel_id,
            HostelRoom.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Room not found.")
    return row


# --- Hostel CRUD -----------------------------------------------------------


async def list_hostels(session: AsyncSession, tenant_id: UUID) -> list[HostelOut]:
    hostels = list(
        await session.scalars(
            select(Hostel)
            .where(Hostel.tenant_id == tenant_id, Hostel.deleted_at.is_(None))
            .order_by(Hostel.sort_order, Hostel.name)
        )
    )
    occ = await _occupancy_by_hostel(session, tenant_id)
    cap_sums = await _room_capacity_sums(session, tenant_id)
    counts = await _room_counts(session, tenant_id)
    wardens = await _warden_names(
        session, tenant_id, {h.warden_user_id for h in hostels if h.warden_user_id}
    )
    return [
        _hostel_out(
            h,
            occupied=occ.get(h.id, 0),
            room_capacity_sum=cap_sums.get(h.id, 0),
            room_count=counts.get(h.id, 0),
            warden_name=wardens.get(h.warden_user_id) if h.warden_user_id else None,
        )
        for h in hostels
    ]


async def get_hostel_detail(
    session: AsyncSession, tenant_id: UUID, hostel_id: UUID
) -> HostelDetailOut:
    hostel = await _get_hostel(session, tenant_id, hostel_id)
    occ = await _occupancy_by_hostel(session, tenant_id)
    cap_sums = await _room_capacity_sums(session, tenant_id)
    counts = await _room_counts(session, tenant_id)
    room_occ = await _occupancy_by_room(session, tenant_id)
    warden = (
        (await _warden_names(session, tenant_id, {hostel.warden_user_id})).get(
            hostel.warden_user_id
        )
        if hostel.warden_user_id
        else None
    )

    base = _hostel_out(
        hostel,
        occupied=occ.get(hostel.id, 0),
        room_capacity_sum=cap_sums.get(hostel.id, 0),
        room_count=counts.get(hostel.id, 0),
        warden_name=warden,
    )

    rooms = list(
        await session.scalars(
            select(HostelRoom)
            .where(
                HostelRoom.tenant_id == tenant_id,
                HostelRoom.hostel_id == hostel_id,
                HostelRoom.deleted_at.is_(None),
            )
            .order_by(HostelRoom.sort_order, HostelRoom.name)
        )
    )
    room_out = [
        HostelRoomOut(
            id=r.id,
            hostel_id=r.hostel_id,
            name=r.name,
            capacity=r.capacity,
            floor=r.floor,
            notes=r.notes,
            is_active=r.is_active,
            sort_order=r.sort_order,
            occupied=room_occ.get(r.id, 0),
            available=max(0, r.capacity - room_occ.get(r.id, 0)) if r.capacity else 0,
        )
        for r in rooms
    ]

    residents = await _residents(session, tenant_id, hostel_id)
    unassigned = sum(1 for r in residents if r.hostel_room_id is None)

    return HostelDetailOut(
        **base.model_dump(),
        rooms=room_out,
        residents=residents,
        unassigned_residents=unassigned,
    )


async def _residents(
    session: AsyncSession, tenant_id: UUID, hostel_id: UUID
) -> list[HostelResidentOut]:
    rows = await session.execute(
        select(Student, SchoolClass, ClassStream, HostelRoom)
        .select_from(Student)
        .outerjoin(
            SchoolClass,
            (SchoolClass.id == Student.class_id)
            & (SchoolClass.tenant_id == Student.tenant_id),
        )
        .outerjoin(
            ClassStream,
            (ClassStream.id == Student.stream_id)
            & (ClassStream.tenant_id == Student.tenant_id),
        )
        .outerjoin(
            HostelRoom,
            (HostelRoom.id == Student.hostel_room_id)
            & (HostelRoom.tenant_id == Student.tenant_id),
        )
        .where(
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
            Student.is_active.is_(True),
            Student.hostel_id == hostel_id,
        )
        .order_by(Student.last_name, Student.first_name)
    )
    out: list[HostelResidentOut] = []
    for student, school_class, stream, room in rows.all():
        out.append(
            HostelResidentOut(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                middle_name=student.middle_name,
                gender=student.gender,
                class_label=(
                    f"{school_class.level.value} {school_class.label}".strip()
                    if school_class
                    else None
                ),
                stream_name=stream.name if stream else None,
                hostel_room_id=student.hostel_room_id,
                room_name=room.name if room else None,
            )
        )
    return out


async def _next_sort_order(session: AsyncSession, tenant_id: UUID) -> int:
    current = await session.scalar(
        select(func.coalesce(func.max(Hostel.sort_order), -1)).where(
            Hostel.tenant_id == tenant_id, Hostel.deleted_at.is_(None)
        )
    )
    return int(current) + 1


async def create_hostel(
    session: AsyncSession, tenant_id: UUID, body: HostelCreate
) -> HostelOut:
    await _assert_code_free(session, tenant_id, body.code, exclude_id=None)
    row = Hostel(
        tenant_id=tenant_id,
        name=body.name.strip(),
        code=(body.code.strip() or None) if body.code else None,
        gender=body.gender,
        capacity=body.capacity,
        warden_user_id=body.warden_user_id,
        location=(body.location.strip() or None) if body.location else None,
        notes=(body.notes.strip() or None) if body.notes else None,
        is_active=body.is_active,
        sort_order=body.sort_order or await _next_sort_order(session, tenant_id),
    )
    session.add(row)
    await session.flush()
    return _hostel_out(
        row, occupied=0, room_capacity_sum=0, room_count=0, warden_name=None
    )


async def _assert_code_free(
    session: AsyncSession, tenant_id: UUID, code: str | None, *, exclude_id: UUID | None
) -> None:
    if not code or not code.strip():
        return
    stmt = select(Hostel.id).where(
        Hostel.tenant_id == tenant_id,
        Hostel.deleted_at.is_(None),
        func.lower(Hostel.code) == code.strip().lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(Hostel.id != exclude_id)
    if await session.scalar(stmt) is not None:
        raise ConflictError(f"A hostel with code '{code.strip()}' already exists.")


async def update_hostel(
    session: AsyncSession, tenant_id: UUID, hostel_id: UUID, body: HostelUpdate
) -> HostelOut:
    row = await _get_hostel(session, tenant_id, hostel_id)
    fields = body.model_fields_set

    if "code" in fields:
        await _assert_code_free(session, tenant_id, body.code, exclude_id=hostel_id)
        row.code = (body.code.strip() or None) if body.code else None
    if "name" in fields and body.name is not None:
        row.name = body.name.strip()
    if "gender" in fields and body.gender is not None:
        row.gender = body.gender
    if "capacity" in fields:
        row.capacity = body.capacity
    if body.clear_warden:
        row.warden_user_id = None
    elif "warden_user_id" in fields:
        row.warden_user_id = body.warden_user_id
    if "location" in fields:
        row.location = (body.location.strip() or None) if body.location else None
    if "notes" in fields:
        row.notes = (body.notes.strip() or None) if body.notes else None
    if "is_active" in fields and body.is_active is not None:
        row.is_active = body.is_active
    if "sort_order" in fields and body.sort_order is not None:
        row.sort_order = body.sort_order

    await session.flush()
    occ = await _occupancy_by_hostel(session, tenant_id)
    cap_sums = await _room_capacity_sums(session, tenant_id)
    counts = await _room_counts(session, tenant_id)
    warden = (
        (await _warden_names(session, tenant_id, {row.warden_user_id})).get(
            row.warden_user_id
        )
        if row.warden_user_id
        else None
    )
    return _hostel_out(
        row,
        occupied=occ.get(row.id, 0),
        room_capacity_sum=cap_sums.get(row.id, 0),
        room_count=counts.get(row.id, 0),
        warden_name=warden,
    )


async def delete_hostel(session: AsyncSession, tenant_id: UUID, hostel_id: UUID) -> None:
    row = await _get_hostel(session, tenant_id, hostel_id)
    occupied = await session.scalar(
        select(func.count())
        .select_from(Student)
        .where(
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
            Student.hostel_id == hostel_id,
        )
    )
    if int(occupied or 0) > 0:
        raise ConflictError(
            "This hostel still has residents. Check them out before deleting it."
        )
    rooms = list(
        await session.scalars(
            select(HostelRoom).where(
                HostelRoom.tenant_id == tenant_id,
                HostelRoom.hostel_id == hostel_id,
                HostelRoom.deleted_at.is_(None),
            )
        )
    )
    now = dt.datetime.now(dt.UTC)
    for room in rooms:
        room.deleted_at = now
    row.deleted_at = now
    await session.flush()


# --- Room CRUD -------------------------------------------------------------


async def create_room(
    session: AsyncSession, tenant_id: UUID, hostel_id: UUID, body: HostelRoomCreate
) -> HostelRoomOut:
    await _get_hostel(session, tenant_id, hostel_id)
    sort_order = body.sort_order
    if not sort_order:
        current = await session.scalar(
            select(func.coalesce(func.max(HostelRoom.sort_order), -1)).where(
                HostelRoom.tenant_id == tenant_id,
                HostelRoom.hostel_id == hostel_id,
                HostelRoom.deleted_at.is_(None),
            )
        )
        sort_order = int(current) + 1
    row = HostelRoom(
        tenant_id=tenant_id,
        hostel_id=hostel_id,
        name=body.name.strip(),
        capacity=body.capacity,
        floor=(body.floor.strip() or None) if body.floor else None,
        notes=(body.notes.strip() or None) if body.notes else None,
        is_active=body.is_active,
        sort_order=sort_order,
    )
    session.add(row)
    await session.flush()
    return HostelRoomOut(
        id=row.id,
        hostel_id=row.hostel_id,
        name=row.name,
        capacity=row.capacity,
        floor=row.floor,
        notes=row.notes,
        is_active=row.is_active,
        sort_order=row.sort_order,
        occupied=0,
        available=row.capacity,
    )


async def update_room(
    session: AsyncSession,
    tenant_id: UUID,
    hostel_id: UUID,
    room_id: UUID,
    body: HostelRoomUpdate,
) -> HostelRoomOut:
    row = await _get_room(session, tenant_id, hostel_id, room_id)
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        row.name = body.name.strip()
    if "capacity" in fields and body.capacity is not None:
        row.capacity = body.capacity
    if "floor" in fields:
        row.floor = (body.floor.strip() or None) if body.floor else None
    if "notes" in fields:
        row.notes = (body.notes.strip() or None) if body.notes else None
    if "is_active" in fields and body.is_active is not None:
        row.is_active = body.is_active
    if "sort_order" in fields and body.sort_order is not None:
        row.sort_order = body.sort_order
    await session.flush()
    occ = await _occupancy_by_room(session, tenant_id)
    occupied = occ.get(row.id, 0)
    return HostelRoomOut(
        id=row.id,
        hostel_id=row.hostel_id,
        name=row.name,
        capacity=row.capacity,
        floor=row.floor,
        notes=row.notes,
        is_active=row.is_active,
        sort_order=row.sort_order,
        occupied=occupied,
        available=max(0, row.capacity - occupied) if row.capacity else 0,
    )


async def delete_room(
    session: AsyncSession, tenant_id: UUID, hostel_id: UUID, room_id: UUID
) -> None:
    row = await _get_room(session, tenant_id, hostel_id, room_id)
    occupied = await session.scalar(
        select(func.count())
        .select_from(Student)
        .where(
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
            Student.hostel_room_id == room_id,
        )
    )
    if int(occupied or 0) > 0:
        raise ConflictError(
            "This room still has residents. Move them out before deleting it."
        )
    row.deleted_at = dt.datetime.now(dt.UTC)
    await session.flush()


# --- Registration options --------------------------------------------------


async def list_options(
    session: AsyncSession, tenant_id: UUID, *, gender: str | None = None
) -> list[HostelOptionOut]:
    """Lightweight hostel + room list for the enrollment dropdowns.

    ``gender`` (the learner's gender) filters to compatible hostels.
    """
    hostels = list(
        await session.scalars(
            select(Hostel)
            .where(
                Hostel.tenant_id == tenant_id,
                Hostel.deleted_at.is_(None),
                Hostel.is_active.is_(True),
            )
            .order_by(Hostel.sort_order, Hostel.name)
        )
    )
    occ = await _occupancy_by_hostel(session, tenant_id)
    cap_sums = await _room_capacity_sums(session, tenant_id)
    room_occ = await _occupancy_by_room(session, tenant_id)

    rooms_by_hostel: dict[UUID, list[HostelRoom]] = {}
    for room in await session.scalars(
        select(HostelRoom)
        .where(
            HostelRoom.tenant_id == tenant_id,
            HostelRoom.deleted_at.is_(None),
            HostelRoom.is_active.is_(True),
        )
        .order_by(HostelRoom.sort_order, HostelRoom.name)
    ):
        rooms_by_hostel.setdefault(room.hostel_id, []).append(room)

    student_gender = (gender or "").strip().lower() or None

    out: list[HostelOptionOut] = []
    for hostel in hostels:
        if student_gender and not _gender_compatible(hostel.gender, student_gender):
            continue
        occupied = occ.get(hostel.id, 0)
        effective = _effective_capacity(hostel, cap_sums.get(hostel.id, 0))
        available = None if effective is None else max(0, effective - occupied)
        room_opts = [
            HostelRoomOptionOut(
                id=r.id,
                name=r.name,
                capacity=r.capacity,
                occupied=room_occ.get(r.id, 0),
                available=max(0, r.capacity - room_occ.get(r.id, 0)) if r.capacity else 0,
                is_full=bool(r.capacity) and room_occ.get(r.id, 0) >= r.capacity,
            )
            for r in rooms_by_hostel.get(hostel.id, [])
        ]
        out.append(
            HostelOptionOut(
                id=hostel.id,
                name=hostel.name,
                gender=hostel.gender,
                effective_capacity=effective,
                occupied=occupied,
                available=available,
                is_full=available is not None and available <= 0,
                rooms=room_opts,
            )
        )
    return out


# --- Allocation & validation ----------------------------------------------


def _gender_compatible(hostel_gender: str, student_gender: str | None) -> bool:
    if hostel_gender == "mixed" or not student_gender:
        return True
    if hostel_gender == "boys":
        return student_gender == "male"
    if hostel_gender == "girls":
        return student_gender == "female"
    return True


async def validate_allocation(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    hostel_id: UUID,
    room_id: UUID | None,
    student_gender: str | None,
    exclude_student_id: UUID | None = None,
) -> tuple[Hostel, HostelRoom | None]:
    """Validate gender + capacity for an allocation; returns (hostel, room)."""
    hostel = await _get_hostel(session, tenant_id, hostel_id)
    if not hostel.is_active:
        raise ValidationError("This hostel is inactive and cannot take new residents.")
    if not _gender_compatible(hostel.gender, student_gender):
        raise ValidationError(
            f"This is a {hostel.gender} hostel; the learner cannot be placed here."
        )

    room: HostelRoom | None = None
    if room_id is not None:
        room = await _get_room(session, tenant_id, hostel_id, room_id)
        if not room.is_active:
            raise ValidationError("This room is inactive.")
        if room.capacity:
            occupied = await _count_room_occupants(
                session, tenant_id, room_id, exclude_student_id
            )
            if occupied >= room.capacity:
                raise ValidationError(f"Room '{room.name}' is full ({room.capacity}).")

    cap_sums = await _room_capacity_sums(session, tenant_id)
    effective = _effective_capacity(hostel, cap_sums.get(hostel.id, 0))
    if effective is not None:
        occupied = await _count_hostel_occupants(
            session, tenant_id, hostel_id, exclude_student_id
        )
        if occupied >= effective:
            raise ValidationError(f"{hostel.name} is full ({effective}).")

    return hostel, room


async def _count_hostel_occupants(
    session: AsyncSession, tenant_id: UUID, hostel_id: UUID, exclude: UUID | None
) -> int:
    stmt = select(func.count()).select_from(Student).where(
        Student.tenant_id == tenant_id,
        Student.deleted_at.is_(None),
        Student.is_active.is_(True),
        Student.hostel_id == hostel_id,
    )
    if exclude is not None:
        stmt = stmt.where(Student.id != exclude)
    return int(await session.scalar(stmt) or 0)


async def _count_room_occupants(
    session: AsyncSession, tenant_id: UUID, room_id: UUID, exclude: UUID | None
) -> int:
    stmt = select(func.count()).select_from(Student).where(
        Student.tenant_id == tenant_id,
        Student.deleted_at.is_(None),
        Student.is_active.is_(True),
        Student.hostel_room_id == room_id,
    )
    if exclude is not None:
        stmt = stmt.where(Student.id != exclude)
    return int(await session.scalar(stmt) or 0)


async def allocate(
    session: AsyncSession, tenant_id: UUID, body: AllocateRequest
) -> HostelDetailOut:
    student = await _get_student(session, tenant_id, body.student_id)
    await validate_allocation(
        session,
        tenant_id,
        hostel_id=body.hostel_id,
        room_id=body.hostel_room_id,
        student_gender=student.gender,
        exclude_student_id=student.id,
    )
    student.hostel_id = body.hostel_id
    student.hostel_room_id = body.hostel_room_id
    student.residence = "boarder"
    await session.flush()
    return await get_hostel_detail(session, tenant_id, body.hostel_id)


async def checkout(
    session: AsyncSession, tenant_id: UUID, student_id: UUID
) -> None:
    student = await _get_student(session, tenant_id, student_id)
    student.hostel_id = None
    student.hostel_room_id = None
    await session.flush()


async def _get_student(session: AsyncSession, tenant_id: UUID, student_id: UUID) -> Student:
    row = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.id == student_id,
            Student.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Student not found.")
    return row

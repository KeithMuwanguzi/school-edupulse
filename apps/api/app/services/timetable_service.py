"""Weekly timetable — slot CRUD, conflict detection, and the teacher day view."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from types import SimpleNamespace

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.school_time import school_now
from app.models.academic import AcademicYear, Term
from app.models.attendance import AttendanceRecord
from app.models.enums import AcademicYearStatus, ClassLevel, TermStatus
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.models.subject import Subject
from app.models.timetable import TimetableSlot
from app.models.user import Role, TenantUser
from app.schemas.timetable import (
    TeacherDayOut,
    TeacherLessonOut,
    TimetableImportRequest,
    TimetableImportResponse,
    TimetableImportRow,
    TimetableImportRowResult,
    TimetableSlotCreate,
    TimetableSlotOut,
    TimetableSlotUpdate,
)

TEACHING_ROLES = frozenset({"teacher", "deputy_head"})

_DAY_LOOKUP: dict[str, int] = {
    "monday": 1, "mon": 1,
    "tuesday": 2, "tue": 2, "tues": 2,
    "wednesday": 3, "wed": 3,
    "thursday": 4, "thu": 4, "thur": 4, "thurs": 4,
    "friday": 5, "fri": 5,
    "saturday": 6, "sat": 6,
    "sunday": 7, "sun": 7,
}


async def _active_year(session: AsyncSession, tenant_id: UUID) -> AcademicYear:
    year = await session.scalar(
        select(AcademicYear).where(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.status == AcademicYearStatus.active,
        )
    )
    if year is None:
        raise ValidationError("No active academic year — set one under Settings.")
    return year


async def _active_term(session: AsyncSession, tenant_id: UUID, year_id: UUID) -> Term | None:
    return await session.scalar(
        select(Term).where(
            Term.tenant_id == tenant_id,
            Term.academic_year_id == year_id,
            Term.status == TermStatus.active,
        )
    )


async def _class_row(session: AsyncSession, tenant_id: UUID, class_id: UUID) -> SchoolClass:
    row = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Class not found.")
    return row


async def _stream_row(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, stream_id: UUID | None
) -> ClassStream | None:
    if stream_id is None:
        return None
    row = await session.scalar(
        select(ClassStream).where(
            ClassStream.tenant_id == tenant_id,
            ClassStream.id == stream_id,
            ClassStream.class_id == class_id,
            ClassStream.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Stream not found for this class.")
    return row


async def _subject_row(session: AsyncSession, tenant_id: UUID, subject_id: UUID) -> Subject:
    row = await session.scalar(
        select(Subject).where(
            Subject.tenant_id == tenant_id,
            Subject.id == subject_id,
            Subject.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Subject not found.")
    return row


async def _teacher_row(session: AsyncSession, tenant_id: UUID, user_id: UUID) -> TenantUser:
    hit = (
        await session.execute(
            select(TenantUser, Role.role_key)
            .join(Role, TenantUser.role_id == Role.id)
            .where(
                TenantUser.tenant_id == tenant_id,
                TenantUser.id == user_id,
                TenantUser.deleted_at.is_(None),
            )
        )
    ).first()
    if hit is None:
        raise NotFoundError("Teacher not found.")
    user, role_key = hit
    if role_key not in TEACHING_ROLES:
        raise ValidationError("Lessons can only be assigned to teachers or deputy heads.")
    return user


def _times_overlap(a_start: dt.time, a_end: dt.time, b_start: dt.time, b_end: dt.time) -> bool:
    return a_start < b_end and a_end > b_start


async def _check_conflicts(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    year_id: UUID,
    body: TimetableSlotCreate | TimetableSlotUpdate,
    exclude_id: UUID | None = None,
) -> None:
    same_day = list(
        await session.scalars(
            select(TimetableSlot).where(
                TimetableSlot.tenant_id == tenant_id,
                TimetableSlot.academic_year_id == year_id,
                TimetableSlot.day_of_week == body.day_of_week,
                TimetableSlot.deleted_at.is_(None),
            )
        )
    )
    for other in same_day:
        if exclude_id is not None and other.id == exclude_id:
            continue
        if not _times_overlap(body.starts_at, body.ends_at, other.starts_at, other.ends_at):
            continue
        if other.teacher_user_id == body.teacher_user_id:
            raise ConflictError("This teacher already has a lesson during that time.")
        if other.class_id == body.class_id:
            # Whole-class slot clashes with anything in the class; otherwise only same stream.
            if (
                other.stream_id is None
                or body.stream_id is None
                or other.stream_id == body.stream_id
            ):
                raise ConflictError("This class already has a lesson during that time.")


async def _lookups(
    session: AsyncSession, tenant_id: UUID
) -> tuple[dict, dict, dict, dict]:
    classes = {
        c.id: c
        for c in await session.scalars(
            select(SchoolClass).where(SchoolClass.tenant_id == tenant_id)
        )
    }
    streams = {
        s.id: s
        for s in await session.scalars(
            select(ClassStream).where(ClassStream.tenant_id == tenant_id)
        )
    }
    subjects = {
        s.id: s
        for s in await session.scalars(
            select(Subject).where(Subject.tenant_id == tenant_id)
        )
    }
    teachers = {
        u.id: u
        for u in await session.scalars(
            select(TenantUser).where(TenantUser.tenant_id == tenant_id)
        )
    }
    return classes, streams, subjects, teachers


def _slot_out(row: TimetableSlot, classes, streams, subjects, teachers) -> TimetableSlotOut:
    cls = classes.get(row.class_id)
    stream = streams.get(row.stream_id) if row.stream_id else None
    subject = subjects.get(row.subject_id)
    teacher = teachers.get(row.teacher_user_id)
    return TimetableSlotOut(
        id=row.id,
        academic_year_id=row.academic_year_id,
        day_of_week=row.day_of_week,
        starts_at=row.starts_at,
        ends_at=row.ends_at,
        class_id=row.class_id,
        class_level=cls.level.value if cls else "",
        class_label=cls.label if cls else "",
        stream_id=row.stream_id,
        stream_name=stream.name if stream else None,
        subject_id=row.subject_id,
        subject_code=subject.code if subject else "",
        subject_name=subject.name if subject else "",
        teacher_user_id=row.teacher_user_id,
        teacher_name=teacher.name if teacher else "",
        period_label=row.period_label,
        room=row.room,
    )


async def list_slots(
    session: AsyncSession, tenant_id: UUID, *, academic_year_id: UUID | None = None
) -> list[TimetableSlotOut]:
    year_id = academic_year_id or (await _active_year(session, tenant_id)).id
    rows = list(
        await session.scalars(
            select(TimetableSlot)
            .where(
                TimetableSlot.tenant_id == tenant_id,
                TimetableSlot.academic_year_id == year_id,
                TimetableSlot.deleted_at.is_(None),
            )
            .order_by(TimetableSlot.day_of_week, TimetableSlot.starts_at)
        )
    )
    classes, streams, subjects, teachers = await _lookups(session, tenant_id)
    return [_slot_out(r, classes, streams, subjects, teachers) for r in rows]


async def create_slot(
    session: AsyncSession, tenant_id: UUID, body: TimetableSlotCreate
) -> TimetableSlotOut:
    year = await _active_year(session, tenant_id)
    await _class_row(session, tenant_id, body.class_id)
    await _stream_row(session, tenant_id, body.class_id, body.stream_id)
    await _subject_row(session, tenant_id, body.subject_id)
    await _teacher_row(session, tenant_id, body.teacher_user_id)
    await _check_conflicts(session, tenant_id, year_id=year.id, body=body)

    row = TimetableSlot(
        tenant_id=tenant_id,
        academic_year_id=year.id,
        day_of_week=body.day_of_week,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        class_id=body.class_id,
        stream_id=body.stream_id,
        subject_id=body.subject_id,
        teacher_user_id=body.teacher_user_id,
        period_label=(body.period_label or None),
        room=(body.room or None),
    )
    session.add(row)
    await session.flush()
    classes, streams, subjects, teachers = await _lookups(session, tenant_id)
    return _slot_out(row, classes, streams, subjects, teachers)


async def update_slot(
    session: AsyncSession, tenant_id: UUID, slot_id: UUID, body: TimetableSlotUpdate
) -> TimetableSlotOut:
    row = await session.scalar(
        select(TimetableSlot).where(
            TimetableSlot.tenant_id == tenant_id,
            TimetableSlot.id == slot_id,
            TimetableSlot.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Lesson slot not found.")

    await _class_row(session, tenant_id, body.class_id)
    await _stream_row(session, tenant_id, body.class_id, body.stream_id)
    await _subject_row(session, tenant_id, body.subject_id)
    await _teacher_row(session, tenant_id, body.teacher_user_id)
    await _check_conflicts(
        session, tenant_id, year_id=row.academic_year_id, body=body, exclude_id=row.id
    )

    row.day_of_week = body.day_of_week
    row.starts_at = body.starts_at
    row.ends_at = body.ends_at
    row.class_id = body.class_id
    row.stream_id = body.stream_id
    row.subject_id = body.subject_id
    row.teacher_user_id = body.teacher_user_id
    row.period_label = body.period_label or None
    row.room = body.room or None
    await session.flush()

    classes, streams, subjects, teachers = await _lookups(session, tenant_id)
    return _slot_out(row, classes, streams, subjects, teachers)


async def delete_slot(session: AsyncSession, tenant_id: UUID, slot_id: UUID) -> None:
    row = await session.scalar(
        select(TimetableSlot).where(
            TimetableSlot.tenant_id == tenant_id,
            TimetableSlot.id == slot_id,
            TimetableSlot.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Lesson slot not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)


async def _enrolled_count(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, stream_id: UUID | None
) -> int:
    stmt = select(func.count()).select_from(Student).where(
        Student.tenant_id == tenant_id,
        Student.class_id == class_id,
        Student.deleted_at.is_(None),
        Student.is_active.is_(True),
    )
    if stream_id is not None:
        stmt = stmt.where(Student.stream_id == stream_id)
    return int(await session.scalar(stmt) or 0)


async def teacher_slots_today(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    teacher_user_id: UUID,
    on_date: dt.date,
) -> list[TimetableSlot]:
    year = await _active_year(session, tenant_id)
    return list(
        await session.scalars(
            select(TimetableSlot)
            .where(
                TimetableSlot.tenant_id == tenant_id,
                TimetableSlot.academic_year_id == year.id,
                TimetableSlot.teacher_user_id == teacher_user_id,
                TimetableSlot.day_of_week == on_date.isoweekday(),
                TimetableSlot.deleted_at.is_(None),
            )
            .order_by(TimetableSlot.starts_at)
        )
    )


async def teacher_can_record(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    teacher_user_id: UUID,
    class_id: UUID,
    stream_id: UUID | None,
    on_date: dt.date,
    now: dt.datetime | None = None,
) -> bool:
    """True if the teacher has a lesson for this class today whose end time has passed."""
    if now is None:
        now = await school_now(session, tenant_id)
    elif now.tzinfo is None:
        tz = (await school_now(session, tenant_id)).tzinfo
        now = now.replace(tzinfo=tz)
    if on_date != now.date():
        return False
    slots = await teacher_slots_today(
        session, tenant_id, teacher_user_id=teacher_user_id, on_date=on_date
    )
    for slot in slots:
        if slot.class_id != class_id:
            continue
        if stream_id is not None and slot.stream_id not in (None, stream_id):
            continue
        if slot.ends_at <= now.time():
            return True
    return False


async def get_teacher_day(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    teacher_user_id: UUID,
    on_date: dt.date,
    now: dt.datetime | None = None,
) -> TeacherDayOut:
    if now is None:
        now = await school_now(session, tenant_id)
    elif now.tzinfo is None:
        tz = (await school_now(session, tenant_id)).tzinfo
        now = now.replace(tzinfo=tz)
    year = await _active_year(session, tenant_id)
    term = await _active_term(session, tenant_id, year.id)
    slots = await teacher_slots_today(
        session, tenant_id, teacher_user_id=teacher_user_id, on_date=on_date
    )
    classes, streams, subjects, teachers = await _lookups(session, tenant_id)
    is_today = on_date == now.date()

    lessons: list[TeacherLessonOut] = []
    for slot in slots:
        base = _slot_out(slot, classes, streams, subjects, teachers)
        has_ended = (not is_today) or (slot.ends_at <= now.time())
        recorded_count = await session.scalar(
            select(func.count())
            .select_from(AttendanceRecord)
            .where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.attendance_date == on_date,
                AttendanceRecord.timetable_slot_id == slot.id,
            )
        )
        enrolled = await _enrolled_count(session, tenant_id, slot.class_id, slot.stream_id)
        lessons.append(
            TeacherLessonOut(
                **base.model_dump(),
                is_today=is_today,
                has_ended=has_ended,
                can_record=is_today and has_ended,
                recorded=int(recorded_count or 0) > 0,
                enrolled=enrolled,
            )
        )

    return TeacherDayOut(
        date=on_date,
        day_of_week=on_date.isoweekday(),
        academic_year_label=year.label,
        term_label=term.label if term else None,
        lessons=lessons,
    )


# --- Bulk import -----------------------------------------------------------


def _parse_day(raw: str) -> int:
    s = raw.strip().lower()
    if s in _DAY_LOOKUP:
        return _DAY_LOOKUP[s]
    if s.isdigit() and 1 <= int(s) <= 7:
        return int(s)
    raise ValueError(f"Unknown day '{raw}' — use Monday…Sunday or 1–7.")


def _parse_time(raw: str) -> dt.time:
    s = raw.strip()
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
        try:
            return dt.datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"Invalid time '{raw}' — use HH:MM (24-hour).")


async def _class_by_level(
    session: AsyncSession, tenant_id: UUID, level: str
) -> SchoolClass | None:
    try:
        target = ClassLevel(level.strip().upper())
    except ValueError:
        return None
    return await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.level == target,
            SchoolClass.deleted_at.is_(None),
        )
    )


async def _stream_by_name(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, name: str
) -> ClassStream | None:
    needle = name.strip().lower()
    for stream in await session.scalars(
        select(ClassStream).where(
            ClassStream.tenant_id == tenant_id,
            ClassStream.class_id == class_id,
            ClassStream.deleted_at.is_(None),
        )
    ):
        if stream.name.strip().lower() == needle:
            return stream
    return None


async def _subject_by_code(
    session: AsyncSession, tenant_id: UUID, code: str
) -> Subject | None:
    needle = code.strip().lower()
    for subject in await session.scalars(
        select(Subject).where(
            Subject.tenant_id == tenant_id,
            Subject.deleted_at.is_(None),
        )
    ):
        if subject.code.strip().lower() == needle:
            return subject
    return None


async def _resolve_teacher(
    session: AsyncSession, tenant_id: UUID, ref: str
) -> tuple[TenantUser | None, str | None]:
    """Resolve a teacher by full name (preferred) or staff/login ID.

    Returns ``(teacher, error_message)``. Names are matched case-insensitively;
    if several teachers share a name we fall back to requiring the login ID.
    """
    needle = ref.strip().lower()
    rows = (
        await session.execute(
            select(TenantUser, Role.role_key)
            .join(Role, TenantUser.role_id == Role.id)
            .where(
                TenantUser.tenant_id == tenant_id,
                TenantUser.deleted_at.is_(None),
            )
        )
    ).all()
    teachers = [user for user, role_key in rows if role_key in TEACHING_ROLES]

    by_login = [u for u in teachers if u.login_id.strip().lower() == needle]
    if by_login:
        return by_login[0], None

    by_name = [u for u in teachers if u.name.strip().lower() == needle]
    if len(by_name) == 1:
        return by_name[0], None
    if len(by_name) > 1:
        return None, f"Several teachers are named '{ref}' — use their staff ID instead."
    return None, f"Teacher '{ref}' not found — check the name matches a teacher exactly."


async def import_slots(
    session: AsyncSession, tenant_id: UUID, body: TimetableImportRequest
) -> TimetableImportResponse:
    year = await _active_year(session, tenant_id)
    results: list[TimetableImportRowResult] = []
    created = failed = valid = 0
    # Track rows accepted in this batch to catch in-file (dry-run) conflicts.
    accepted: list[SimpleNamespace] = []

    for i, row in enumerate(body.rows, start=1):
        ident = f"{row.day} {row.starts_at} {row.class_level} {row.subject_code}".strip()
        try:
            day = _parse_day(row.day)
            starts = _parse_time(row.starts_at)
            ends = _parse_time(row.ends_at)
            if ends <= starts:
                raise ValueError("End time must be after the start time.")

            school_class = await _class_by_level(session, tenant_id, row.class_level)
            if school_class is None:
                raise ValueError(f"Class {row.class_level} not found — set up classes first.")

            stream_id: UUID | None = None
            if row.stream_name and row.stream_name.strip():
                stream = await _stream_by_name(
                    session, tenant_id, school_class.id, row.stream_name
                )
                if stream is None:
                    raise ValueError(
                        f"Stream '{row.stream_name}' not found in {row.class_level}."
                    )
                stream_id = stream.id

            subject = await _subject_by_code(session, tenant_id, row.subject_code)
            if subject is None:
                raise ValueError(f"Subject '{row.subject_code}' not found.")

            teacher, teacher_err = await _resolve_teacher(session, tenant_id, row.teacher)
            if teacher is None:
                raise ValueError(teacher_err)

            candidate = SimpleNamespace(
                day_of_week=day,
                starts_at=starts,
                ends_at=ends,
                class_id=school_class.id,
                stream_id=stream_id,
                teacher_user_id=teacher.id,
            )
            # In-file conflicts (dry run has nothing in the DB yet).
            for other in accepted:
                if other.day_of_week != day:
                    continue
                if not _times_overlap(starts, ends, other.starts_at, other.ends_at):
                    continue
                if other.teacher_user_id == teacher.id:
                    raise ConflictError("This teacher already has a lesson during that time.")
                if other.class_id == school_class.id and (
                    other.stream_id is None or stream_id is None or other.stream_id == stream_id
                ):
                    raise ConflictError("This class already has a lesson during that time.")
            # Conflicts against already-stored slots.
            await _check_conflicts(session, tenant_id, year_id=year.id, body=candidate)

            valid += 1
            if body.dry_run:
                accepted.append(candidate)
                results.append(
                    TimetableImportRowResult(
                        line=i, identifier=ident, status="valid", message="Ready to import"
                    )
                )
                continue

            session.add(
                TimetableSlot(
                    tenant_id=tenant_id,
                    academic_year_id=year.id,
                    day_of_week=day,
                    starts_at=starts,
                    ends_at=ends,
                    class_id=school_class.id,
                    stream_id=stream_id,
                    subject_id=subject.id,
                    teacher_user_id=teacher.id,
                    room=(row.room.strip() if row.room else None),
                )
            )
            await session.flush()
            accepted.append(candidate)
            created += 1
            results.append(
                TimetableImportRowResult(line=i, identifier=ident, status="created")
            )
        except (ValueError, ConflictError, NotFoundError) as exc:
            failed += 1
            message = exc.detail if isinstance(exc, (ConflictError, NotFoundError)) else str(exc)
            results.append(
                TimetableImportRowResult(
                    line=i, identifier=ident, status="failed", message=message
                )
            )

    return TimetableImportResponse(
        created=created, failed=failed, valid=valid, results=results
    )

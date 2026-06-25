"""Daily attendance — Phase 2 §7."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.school_time import school_now, school_today
from app.models.academic import AcademicYear, Term
from app.models.attendance import AttendanceRecord
from app.models.enums import AcademicYearStatus, AttendanceStatus, TermStatus
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.schemas.attendance import (
    AttendanceDailySummary,
    AttendanceMarkRequest,
    AttendanceMarkResponse,
    AttendanceRollOut,
    AttendanceRollRow,
    ClassAttendanceCount,
    ClassAttendanceDayOut,
    ClassAttendanceLessonOut,
)
from app.services import timetable_service
from app.services.term_roster_service import registered_students_stmt

# Only teachers record attendance, and only from their own timetable lessons.
# Admins and deputy heads have view-only access to stats and per-class records.
MARKING_ROLES = frozenset({"teacher"})
CHRONIC_RATE_THRESHOLD = 80.0
CHRONIC_MIN_DAYS = 3
_STATUS_PRIORITY = {
    AttendanceStatus.absent: 0,
    AttendanceStatus.late: 1,
    AttendanceStatus.excused: 2,
    AttendanceStatus.present: 3,
}


def _worst_status(statuses: list[AttendanceStatus]) -> AttendanceStatus:
    if not statuses:
        return AttendanceStatus.present
    return min(statuses, key=lambda s: _STATUS_PRIORITY[s])


def _records_by_student(
    records: list[AttendanceRecord],
) -> dict[UUID, list[AttendanceRecord]]:
    grouped: dict[UUID, list[AttendanceRecord]] = {}
    for record in records:
        grouped.setdefault(record.student_id, []).append(record)
    return grouped


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


async def _active_term(
    session: AsyncSession, tenant_id: UUID, year_id: UUID
) -> Term | None:
    return await session.scalar(
        select(Term).where(
            Term.tenant_id == tenant_id,
            Term.academic_year_id == year_id,
            Term.status == TermStatus.active,
        )
    )


async def _class_row(
    session: AsyncSession, tenant_id: UUID, class_id: UUID
) -> SchoolClass:
    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")
    return school_class


async def _ensure_can_mark_slot(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    user_id: UUID,
    role: str,
    slot_id: UUID,
    class_id: UUID,
    stream_id: UUID | None,
    on_date: dt.date,
    now: dt.datetime | None = None,
) -> TimetableSlot:
    """Teachers may record attendance only for their own lesson once it has ended."""
    if now is None:
        now = await school_now(session, tenant_id)
    elif now.tzinfo is None:
        tz = (await school_now(session, tenant_id)).tzinfo
        now = now.replace(tzinfo=tz)
    if role != "teacher":
        raise ForbiddenError(
            "Attendance is recorded by teachers from their timetable lessons. "
            "Admins have view-only access."
        )
    if on_date != now.date():
        raise ForbiddenError("You can only record attendance for today's lessons.")

    slot = await session.scalar(
        select(TimetableSlot).where(
            TimetableSlot.tenant_id == tenant_id,
            TimetableSlot.id == slot_id,
            TimetableSlot.deleted_at.is_(None),
        )
    )
    if slot is None:
        raise NotFoundError("Timetable lesson not found.")
    if slot.teacher_user_id != user_id:
        raise ForbiddenError("You can only record attendance for your own lessons.")
    if slot.class_id != class_id:
        raise ForbiddenError("This lesson does not match the selected class.")
    if stream_id is not None and slot.stream_id not in (None, stream_id):
        raise ForbiddenError("This lesson does not match the selected stream.")
    if slot.day_of_week != on_date.isoweekday():
        raise ForbiddenError("This lesson is not scheduled for the selected day.")
    if slot.ends_at > now.time():
        raise ForbiddenError("You can record attendance once the lesson has ended.")
    return slot


async def _ensure_can_mark_class(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    user_id: UUID,
    role: str,
    class_id: UUID,
    stream_id: UUID | None,
    on_date: dt.date,
    timetable_slot_id: UUID | None = None,
    now: dt.datetime | None = None,
) -> None:
    if timetable_slot_id is not None:
        await _ensure_can_mark_slot(
            session,
            tenant_id,
            user_id=user_id,
            role=role,
            slot_id=timetable_slot_id,
            class_id=class_id,
            stream_id=stream_id,
            on_date=on_date,
            now=now,
        )
        return
    if now is None:
        now = await school_now(session, tenant_id)
    elif now.tzinfo is None:
        tz = (await school_now(session, tenant_id)).tzinfo
        now = now.replace(tzinfo=tz)
    if role != "teacher":
        raise ForbiddenError(
            "Attendance is recorded by teachers from their timetable lessons. "
            "Admins have view-only access."
        )
    if on_date != now.date():
        raise ForbiddenError("You can only record attendance for today's lessons.")

    slots = await timetable_service.teacher_slots_today(
        session, tenant_id, teacher_user_id=user_id, on_date=on_date
    )
    class_slots = [
        s
        for s in slots
        if s.class_id == class_id
        and (stream_id is None or s.stream_id in (None, stream_id))
    ]
    if not class_slots:
        raise ForbiddenError("You have no lesson scheduled with this class today.")
    if not any(s.ends_at <= now.time() for s in class_slots):
        raise ForbiddenError("You can record attendance once the lesson has ended.")


async def _term_roster(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    class_id: UUID,
    stream_id: UUID | None,
    term: Term | None,
) -> list[Student]:
    """Students registered for the active term in this class/stream."""
    if term is None:
        return []
    return list(
        await session.scalars(
            registered_students_stmt(
                tenant_id, term.id, class_id=class_id, stream_id=stream_id
            )
        )
    )


async def _term_rate(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    *,
    academic_year_id: UUID,
    term_id: UUID | None,
) -> float | None:
    stmt = select(AttendanceRecord.attendance_date, AttendanceRecord.status).where(
        AttendanceRecord.tenant_id == tenant_id,
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.academic_year_id == academic_year_id,
    )
    if term_id is not None:
        stmt = stmt.where(AttendanceRecord.term_id == term_id)

    rows = list(await session.execute(stmt))
    if not rows:
        return None

    by_date: dict[dt.date, list[AttendanceStatus]] = {}
    for on_date, status in rows:
        by_date.setdefault(on_date, []).append(status)

    if len(by_date) < CHRONIC_MIN_DAYS:
        return None

    attended = sum(
        1
        for statuses in by_date.values()
        if _worst_status(statuses)
        in (AttendanceStatus.present, AttendanceStatus.late, AttendanceStatus.excused)
    )
    return round(attended / len(by_date) * 100, 1)


async def get_daily_summary(
    session: AsyncSession, tenant_id: UUID, *, on_date: dt.date
) -> AttendanceDailySummary:
    year = await _active_year(session, tenant_id)
    term = await _active_term(session, tenant_id, year.id)

    classes = list(
        await session.scalars(
            select(SchoolClass)
            .where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.deleted_at.is_(None),
                SchoolClass.is_active.is_(True),
            )
            .order_by(SchoolClass.sort_order, SchoolClass.level)
        )
    )

    records = list(
        await session.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.attendance_date == on_date,
            )
        )
    )

    class_counts: list[ClassAttendanceCount] = []
    total_enrolled = 0
    present = absent = late = excused = 0
    marked_student_ids: set[UUID] = set()

    for school_class in classes:
        students = await _term_roster(
            session,
            tenant_id,
            class_id=school_class.id,
            stream_id=None,
            term=term,
        )
        enrolled = len(students)
        total_enrolled += enrolled
        student_ids = {s.id for s in students}
        class_records = [r for r in records if r.student_id in student_ids]
        by_student = _records_by_student(class_records)

        c_present = c_absent = c_late = c_excused = 0
        for recs in by_student.values():
            status = _worst_status([r.status for r in recs])
            if status == AttendanceStatus.present:
                c_present += 1
            elif status == AttendanceStatus.absent:
                c_absent += 1
            elif status == AttendanceStatus.late:
                c_late += 1
            else:
                c_excused += 1

        present += c_present
        absent += c_absent
        late += c_late
        excused += c_excused
        marked_student_ids.update(by_student.keys())

        class_counts.append(
            ClassAttendanceCount(
                class_id=school_class.id,
                level=school_class.level.value,
                label=school_class.label,
                enrolled=enrolled,
                marked=len(by_student),
                present=c_present,
                absent=c_absent,
                late=c_late,
                excused=c_excused,
            )
        )

    chronic = 0
    if term:
        active_students = list(
            await session.scalars(
                registered_students_stmt(tenant_id, term.id).where(
                    Student.class_id.is_not(None)
                )
            )
        )
        for student in active_students:
            rate = await _term_rate(
                session,
                tenant_id,
                student.id,
                academic_year_id=year.id,
                term_id=term.id,
            )
            if rate is not None and rate < CHRONIC_RATE_THRESHOLD:
                chronic += 1

    return AttendanceDailySummary(
        date=on_date,
        academic_year_label=year.label,
        term_label=term.label if term else None,
        total_enrolled=total_enrolled,
        total_marked=len(marked_student_ids),
        present=present,
        absent=absent,
        late=late,
        excused=excused,
        chronic_absentees=chronic,
        classes=class_counts,
    )


async def get_roll(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    class_id: UUID,
    stream_id: UUID | None,
    on_date: dt.date,
    timetable_slot_id: UUID | None = None,
) -> AttendanceRollOut:
    school_class = await _class_row(session, tenant_id, class_id)
    stream_name: str | None = None
    if stream_id is not None:
        stream = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.id == stream_id,
                ClassStream.class_id == class_id,
                ClassStream.deleted_at.is_(None),
            )
        )
        if stream is None:
            raise NotFoundError("Stream not found for this class.")
        stream_name = stream.name

    year = await _active_year(session, tenant_id)
    term = await _active_term(session, tenant_id, year.id)

    students = await _term_roster(
        session, tenant_id, class_id=class_id, stream_id=stream_id, term=term
    )
    student_ids = [s.id for s in students]
    existing: dict[UUID, AttendanceRecord] = {}
    if student_ids:
        stmt = select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == tenant_id,
            AttendanceRecord.attendance_date == on_date,
            AttendanceRecord.student_id.in_(student_ids),
        )
        if timetable_slot_id is not None:
            stmt = stmt.where(
                AttendanceRecord.timetable_slot_id == timetable_slot_id
            )
        records = list(await session.scalars(stmt))
        if timetable_slot_id is not None:
            existing = {r.student_id: r for r in records}
        else:
            for student_id, recs in _records_by_student(records).items():
                existing[student_id] = min(
                    recs, key=lambda r: _STATUS_PRIORITY[r.status]
                )

    rows: list[AttendanceRollRow] = []
    counts = {s.value: 0 for s in AttendanceStatus}

    for student in students:
        record = existing.get(student.id)
        status = record.status.value if record else AttendanceStatus.present.value
        counts[status] = counts.get(status, 0) + 1
        term_rate = await _term_rate(
            session,
            tenant_id,
            student.id,
            academic_year_id=year.id,
            term_id=term.id if term else None,
        )
        rows.append(
            AttendanceRollRow(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                status=status,
                remarks=record.remarks if record else None,
                saved=record is not None,
                term_rate=term_rate,
            )
        )

    return AttendanceRollOut(
        date=on_date,
        class_id=class_id,
        class_level=school_class.level.value,
        stream_id=stream_id,
        stream_name=stream_name,
        timetable_slot_id=timetable_slot_id,
        rows=rows,
        present=counts["present"],
        absent=counts["absent"],
        late=counts["late"],
        excused=counts["excused"],
    )


async def mark_roll(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    marker_user_id: UUID,
    marker_role: str,
    body: AttendanceMarkRequest,
) -> AttendanceMarkResponse:
    if marker_role not in MARKING_ROLES:
        raise ForbiddenError("You do not have permission to mark attendance.")

    on_date = body.date or await school_today(session, tenant_id)
    today = await school_today(session, tenant_id)
    if on_date > today:
        raise ValidationError("Cannot mark attendance for a future date.")

    await _ensure_can_mark_class(
        session,
        tenant_id,
        user_id=marker_user_id,
        role=marker_role,
        class_id=body.class_id,
        stream_id=body.stream_id,
        on_date=on_date,
        timetable_slot_id=body.timetable_slot_id,
    )
    await _class_row(session, tenant_id, body.class_id)

    if body.stream_id is not None:
        stream = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.id == body.stream_id,
                ClassStream.class_id == body.class_id,
                ClassStream.deleted_at.is_(None),
            )
        )
        if stream is None:
            raise NotFoundError("Stream not found for this class.")

    year = await _active_year(session, tenant_id)
    term = await _active_term(session, tenant_id, year.id)

    if term is None:
        raise ValidationError("No active term — set one under Settings.")

    roster_students = await _term_roster(
        session,
        tenant_id,
        class_id=body.class_id,
        stream_id=body.stream_id,
        term=term,
    )
    roster_ids = {s.id: s for s in roster_students}

    if not roster_ids:
        raise ValidationError(
            "No students registered for this term in this class roster."
        )

    counts = {s.value: 0 for s in AttendanceStatus}
    saved = 0

    for row in body.records:
        student = roster_ids.get(row.student_id)
        if student is None:
            raise ValidationError("Student is not registered for this term in this class.")

        status = AttendanceStatus(row.status)
        counts[status.value] += 1

        lookup = select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == tenant_id,
            AttendanceRecord.student_id == row.student_id,
            AttendanceRecord.attendance_date == on_date,
        )
        if body.timetable_slot_id is not None:
            lookup = lookup.where(
                AttendanceRecord.timetable_slot_id == body.timetable_slot_id
            )
        else:
            lookup = lookup.where(AttendanceRecord.timetable_slot_id.is_(None))
        existing = await session.scalar(lookup)
        if existing:
            existing.status = status
            existing.remarks = row.remarks.strip() if row.remarks else None
            existing.marked_by_user_id = marker_user_id
            existing.class_id = body.class_id
            existing.stream_id = body.stream_id or student.stream_id
            existing.academic_year_id = year.id
            existing.term_id = term.id if term else None
            existing.timetable_slot_id = body.timetable_slot_id
        else:
            session.add(
                AttendanceRecord(
                    tenant_id=tenant_id,
                    student_id=row.student_id,
                    attendance_date=on_date,
                    status=status,
                    remarks=row.remarks.strip() if row.remarks else None,
                    marked_by_user_id=marker_user_id,
                    academic_year_id=year.id,
                    term_id=term.id if term else None,
                    class_id=body.class_id,
                    stream_id=body.stream_id or student.stream_id,
                    timetable_slot_id=body.timetable_slot_id,
                )
            )
        saved += 1

    await session.flush()

    return AttendanceMarkResponse(
        date=on_date,
        saved=saved,
        present=counts["present"],
        absent=counts["absent"],
        late=counts["late"],
        excused=counts["excused"],
    )


async def get_class_attendance_day(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    class_id: UUID,
    stream_id: UUID | None = None,
    on_date: dt.date,
) -> ClassAttendanceDayOut:
    """Timetable lessons for a class on a date, with per-period attendance stats."""
    school_class = await _class_row(session, tenant_id, class_id)
    year = await _active_year(session, tenant_id)
    term = await _active_term(session, tenant_id, year.id)

    stream_name: str | None = None
    if stream_id is not None:
        stream = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.id == stream_id,
                ClassStream.deleted_at.is_(None),
            )
        )
        stream_name = stream.name if stream else None

    slot_stmt = (
        select(TimetableSlot)
        .where(
            TimetableSlot.tenant_id == tenant_id,
            TimetableSlot.academic_year_id == year.id,
            TimetableSlot.class_id == class_id,
            TimetableSlot.day_of_week == on_date.isoweekday(),
            TimetableSlot.deleted_at.is_(None),
        )
        .order_by(TimetableSlot.starts_at)
    )
    if stream_id is not None:
        slot_stmt = slot_stmt.where(
            or_(TimetableSlot.stream_id.is_(None), TimetableSlot.stream_id == stream_id)
        )
    slots = list(await session.scalars(slot_stmt))

    classes, streams, subjects, teachers = await timetable_service._lookups(
        session, tenant_id
    )
    lessons: list[ClassAttendanceLessonOut] = []
    for slot in slots:
        base = timetable_service._slot_out(slot, classes, streams, subjects, teachers)
        enrolled = await timetable_service._enrolled_count(
            session, tenant_id, slot.class_id, slot.stream_id
        )
        rows = list(
            await session.scalars(
                select(AttendanceRecord).where(
                    AttendanceRecord.tenant_id == tenant_id,
                    AttendanceRecord.attendance_date == on_date,
                    AttendanceRecord.timetable_slot_id == slot.id,
                )
            )
        )
        counts = {s.value: 0 for s in AttendanceStatus}
        for record in rows:
            counts[record.status.value] += 1
        lessons.append(
            ClassAttendanceLessonOut(
                slot_id=slot.id,
                starts_at=base.starts_at,
                ends_at=base.ends_at,
                subject_code=base.subject_code,
                subject_name=base.subject_name,
                teacher_name=base.teacher_name,
                period_label=base.period_label,
                room=base.room,
                enrolled=enrolled,
                recorded=len(rows) > 0,
                present=counts["present"],
                absent=counts["absent"],
                late=counts["late"],
                excused=counts["excused"],
            )
        )

    return ClassAttendanceDayOut(
        date=on_date,
        day_of_week=on_date.isoweekday(),
        class_id=class_id,
        class_label=school_class.label,
        class_level=school_class.level.value,
        stream_id=stream_id,
        stream_name=stream_name,
        academic_year_label=year.label,
        term_label=term.label if term else None,
        lessons=lessons,
    )

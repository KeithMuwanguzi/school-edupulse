"""Term roster — students fully registered for the active term.

Operational modules (attendance, examinations, etc.) should use this roster
instead of the full onboarded student listing.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Term
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.models.term_registration import StudentTermRegistration
from app.schemas.term_registration import (
    RegisteredClassSummaryOut,
    RegisteredRosterSummaryOut,
    RegisteredStreamSummaryOut,
    RegisteredStudentOut,
)
from app.services.term_registration_service import _resolve_term, _student_placement


def registered_students_stmt(
    tenant_id: UUID,
    term_id: UUID,
    *,
    class_id: UUID | None = None,
    stream_id: UUID | None = None,
    unassigned: bool = False,
) -> Select:
    """Students with completed term registration for the given term."""
    stmt = (
        select(Student)
        .join(
            StudentTermRegistration,
            (StudentTermRegistration.student_id == Student.id)
            & (StudentTermRegistration.tenant_id == Student.tenant_id),
        )
        .where(
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
            Student.is_active.is_(True),
            Student.status == "enrolled",
            StudentTermRegistration.term_id == term_id,
            StudentTermRegistration.status == "complete",
        )
    )
    if unassigned:
        stmt = stmt.where(Student.class_id.is_(None))
    elif class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
        if stream_id is not None:
            stmt = stmt.where(Student.stream_id == stream_id)
    return stmt.order_by(Student.student_number, Student.id)


async def list_registered_students(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
    class_id: UUID | None = None,
    stream_id: UUID | None = None,
    unassigned: bool = False,
    q: str | None = None,
    limit: int = 200,
) -> tuple[list[RegisteredStudentOut], Term]:
    term = await _resolve_term(session, tenant_id, term_id)
    stmt = registered_students_stmt(
        tenant_id,
        term.id,
        class_id=class_id,
        stream_id=stream_id,
        unassigned=unassigned,
    )
    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Student.first_name.ilike(needle),
                Student.last_name.ilike(needle),
                Student.student_number.ilike(needle),
            )
        )
    stmt = stmt.limit(limit)
    students = list(await session.scalars(stmt))

    reg_rows = list(
        await session.scalars(
            select(StudentTermRegistration).where(
                StudentTermRegistration.tenant_id == tenant_id,
                StudentTermRegistration.term_id == term.id,
                StudentTermRegistration.status == "complete",
                StudentTermRegistration.student_id.in_([s.id for s in students])
                if students
                else False,
            )
        )
    )
    reg_by_student = {r.student_id: r for r in reg_rows}

    items: list[RegisteredStudentOut] = []
    for student in students:
        reg = reg_by_student.get(student.id)
        class_level, class_label, stream_name = await _student_placement(
            session, tenant_id, student
        )
        items.append(
            RegisteredStudentOut(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                class_level=class_level,
                class_label=class_label,
                stream_name=stream_name,
                registration_id=reg.id if reg else None,
                registered_at=reg.completed_at if reg else None,
            )
        )
    return items, term


async def registered_roster_summary(
    session: AsyncSession, tenant_id: UUID, term_id: UUID | None = None
) -> RegisteredRosterSummaryOut:
    term = await _resolve_term(session, tenant_id, term_id)

    total_registered = int(
        await session.scalar(
            select(func.count())
            .select_from(StudentTermRegistration)
            .where(
                StudentTermRegistration.tenant_id == tenant_id,
                StudentTermRegistration.term_id == term.id,
                StudentTermRegistration.status == "complete",
            )
        )
        or 0
    )

    classes = list(
        await session.scalars(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.deleted_at.is_(None),
            ).order_by(SchoolClass.sort_order, SchoolClass.level)
        )
    )

    class_summaries: list[dict] = []
    unassigned = 0

    for school_class in classes:
        class_count = int(
            await session.scalar(
                select(func.count())
                .select_from(Student)
                .join(
                    StudentTermRegistration,
                    (StudentTermRegistration.student_id == Student.id)
                    & (StudentTermRegistration.tenant_id == Student.tenant_id),
                )
                .where(
                    Student.tenant_id == tenant_id,
                    Student.deleted_at.is_(None),
                    Student.is_active.is_(True),
                    Student.class_id == school_class.id,
                    StudentTermRegistration.term_id == term.id,
                    StudentTermRegistration.status == "complete",
                )
            )
            or 0
        )
        streams = list(
            await session.scalars(
                select(ClassStream).where(
                    ClassStream.tenant_id == tenant_id,
                    ClassStream.class_id == school_class.id,
                    ClassStream.deleted_at.is_(None),
                ).order_by(ClassStream.sort_order, ClassStream.name)
            )
        )
        stream_summaries = []
        for stream in streams:
            stream_count = int(
                await session.scalar(
                    select(func.count())
                    .select_from(Student)
                    .join(
                        StudentTermRegistration,
                        (StudentTermRegistration.student_id == Student.id)
                        & (StudentTermRegistration.tenant_id == Student.tenant_id),
                    )
                    .where(
                        Student.tenant_id == tenant_id,
                        Student.deleted_at.is_(None),
                        Student.is_active.is_(True),
                        Student.class_id == school_class.id,
                        Student.stream_id == stream.id,
                        StudentTermRegistration.term_id == term.id,
                        StudentTermRegistration.status == "complete",
                    )
                )
                or 0
            )
            stream_summaries.append(
                {
                    "stream_id": stream.id,
                    "name": stream.name,
                    "count": stream_count,
                }
            )
        class_summaries.append(
            {
                "class_id": school_class.id,
                "level": school_class.level.value,
                "label": school_class.label,
                "count": class_count,
                "streams": stream_summaries,
            }
        )

    unassigned = int(
        await session.scalar(
            select(func.count())
            .select_from(Student)
            .join(
                StudentTermRegistration,
                (StudentTermRegistration.student_id == Student.id)
                & (StudentTermRegistration.tenant_id == Student.tenant_id),
            )
            .where(
                Student.tenant_id == tenant_id,
                Student.deleted_at.is_(None),
                Student.is_active.is_(True),
                Student.class_id.is_(None),
                StudentTermRegistration.term_id == term.id,
                StudentTermRegistration.status == "complete",
            )
        )
        or 0
    )

    enrolled_total = int(
        await session.scalar(
            select(func.count())
            .select_from(Student)
            .where(
                Student.tenant_id == tenant_id,
                Student.deleted_at.is_(None),
                Student.is_active.is_(True),
                Student.status == "enrolled",
            )
        )
        or 0
    )

    return RegisteredRosterSummaryOut(
        term_id=term.id,
        term_label=term.label,
        total_registered=total_registered,
        total_enrolled=enrolled_total,
        unassigned=unassigned,
        classes=[
            RegisteredClassSummaryOut(
                class_id=c["class_id"],
                level=c["level"],
                label=c["label"],
                count=c["count"],
                streams=[
                    RegisteredStreamSummaryOut(
                        stream_id=s["stream_id"],
                        name=s["name"],
                        count=s["count"],
                    )
                    for s in c["streams"]
                ],
            )
            for c in class_summaries
        ],
    )


async def load_registered_students(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    class_id: UUID,
    stream_id: UUID | None,
    term_id: UUID | None = None,
) -> tuple[list[Student], Term]:
    """Load enrolled students registered for the term — for operational modules."""
    term = await _resolve_term(session, tenant_id, term_id)
    stmt = registered_students_stmt(
        tenant_id, term.id, class_id=class_id, stream_id=stream_id
    )
    students = list(await session.scalars(stmt))
    return students, term

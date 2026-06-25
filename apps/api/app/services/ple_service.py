"""P7 PLE candidacy — Phase 2 §11."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.academic import AcademicYear, Term
from app.models.enums import ClassLevel, TermStatus
from app.models.ple import PleCandidate
from app.models.school_class import SchoolClass
from app.models.student import Student
from app.models.term_registration import StudentTermRegistration
from app.schemas.ple import (
    PleCandidateNominate,
    PleCandidateOut,
    PleCandidateStudentOut,
    PleCandidateUpdate,
    PleCandidacySummaryOut,
    PleEligibleStudentOut,
    PleReadinessOut,
)
from app.services import assessment_service
from app.services.term_registration_service import _resolve_term, _student_placement
from app.services.term_roster_service import registered_students_stmt

_VALID_STATUSES = frozenset({"nominated", "registered", "withdrawn", "completed"})
_TRANSITIONS: dict[str, frozenset[str]] = {
    "nominated": frozenset({"registered", "withdrawn"}),
    "registered": frozenset({"withdrawn", "completed"}),
    "withdrawn": frozenset({"nominated", "registered"}),
    "completed": frozenset(),
}


async def _resolve_year(
    session: AsyncSession,
    tenant_id: UUID,
    academic_year_id: UUID | None,
) -> tuple[AcademicYear, Term]:
    term = await _resolve_term(session, tenant_id, None)
    if academic_year_id is not None:
        year = await session.scalar(
            select(AcademicYear).where(
                AcademicYear.tenant_id == tenant_id,
                AcademicYear.id == academic_year_id,
            )
        )
        if year is None:
            raise NotFoundError("Academic year not found.")
        if term.academic_year_id != year.id:
            active_term = await session.scalar(
                select(Term).where(
                    Term.tenant_id == tenant_id,
                    Term.academic_year_id == year.id,
                    Term.status == TermStatus.active,
                )
                .limit(1)
            )
            if active_term is not None:
                term = active_term
        return year, term
    year = await session.get(AcademicYear, term.academic_year_id)
    if year is None:
        raise NotFoundError("Academic year not found.")
    return year, term


async def _readiness(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term: Term,
) -> PleReadinessOut:
    average, aggregate, division = await assessment_service.student_term_summary(
        session, tenant_id, student_id, term.id
    )
    marks_available = average is not None
    return PleReadinessOut(
        term_id=term.id,
        term_label=term.label,
        average_score=average,
        aggregate=aggregate,
        division_label=division,
        marks_available=marks_available,
    )


async def _student_out(
    session: AsyncSession,
    tenant_id: UUID,
    student: Student,
) -> PleCandidateStudentOut:
    _, class_label, stream_name = await _student_placement(session, tenant_id, student)
    return PleCandidateStudentOut(
        student_id=student.id,
        student_number=student.student_number,
        first_name=student.first_name,
        last_name=student.last_name,
        middle_name=student.middle_name,
        class_label=class_label,
        stream_name=stream_name,
    )


async def _candidate_out(
    session: AsyncSession,
    tenant_id: UUID,
    row: PleCandidate,
    *,
    year: AcademicYear,
    term: Term,
) -> PleCandidateOut:
    student = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.id == row.student_id,
            Student.deleted_at.is_(None),
        )
    )
    if student is None:
        raise NotFoundError("Student not found for candidate record.")
    readiness = await _readiness(session, tenant_id, student.id, term)
    return PleCandidateOut(
        id=row.id,
        student_id=row.student_id,
        academic_year_id=row.academic_year_id,
        academic_year_label=year.label,
        status=row.status,
        candidate_number=row.candidate_number,
        registered_on=row.registered_on,
        withdrawn_on=row.withdrawn_on,
        withdrawal_reason=row.withdrawal_reason,
        notes=row.notes,
        student=await _student_out(session, tenant_id, student),
        readiness=readiness,
    )


async def _assert_p7_registered(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term: Term,
) -> Student:
    student = await session.scalar(
        select(Student)
        .join(
            StudentTermRegistration,
            (StudentTermRegistration.student_id == Student.id)
            & (StudentTermRegistration.tenant_id == Student.tenant_id),
        )
        .join(SchoolClass, Student.class_id == SchoolClass.id)
        .where(
            Student.tenant_id == tenant_id,
            Student.id == student_id,
            Student.deleted_at.is_(None),
            Student.is_active.is_(True),
            StudentTermRegistration.term_id == term.id,
            StudentTermRegistration.status == "complete",
            SchoolClass.level == ClassLevel.P7,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if student is None:
        raise ValidationError(
            "Only fully registered P7 learners can be nominated as PLE candidates."
        )
    return student


async def summary(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    academic_year_id: UUID | None = None,
) -> PleCandidacySummaryOut:
    year, term = await _resolve_year(session, tenant_id, academic_year_id)

    p7_stmt = (
        registered_students_stmt(tenant_id, term.id)
        .join(SchoolClass, Student.class_id == SchoolClass.id)
        .where(SchoolClass.level == ClassLevel.P7)
    )
    total_p7 = int(await session.scalar(select(func.count()).select_from(p7_stmt.subquery())) or 0)

    rows = list(
        await session.scalars(
            select(PleCandidate).where(
                PleCandidate.tenant_id == tenant_id,
                PleCandidate.academic_year_id == year.id,
                PleCandidate.deleted_at.is_(None),
            )
        )
    )
    counts = {status: 0 for status in _VALID_STATUSES}
    for row in rows:
        counts[row.status] = counts.get(row.status, 0) + 1

    active_candidates = sum(
        counts[s] for s in ("nominated", "registered", "completed")
    )
    return PleCandidacySummaryOut(
        academic_year_id=year.id,
        academic_year_label=year.label,
        term_label=term.label,
        total_p7_registered=total_p7,
        nominated=counts["nominated"],
        registered=counts["registered"],
        withdrawn=counts["withdrawn"],
        completed=counts["completed"],
        not_nominated=max(0, total_p7 - active_candidates),
    )


async def list_candidates(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    academic_year_id: UUID | None = None,
    status: str | None = None,
) -> list[PleCandidateOut]:
    year, term = await _resolve_year(session, tenant_id, academic_year_id)
    stmt = (
        select(PleCandidate)
        .where(
            PleCandidate.tenant_id == tenant_id,
            PleCandidate.academic_year_id == year.id,
            PleCandidate.deleted_at.is_(None),
        )
        .order_by(PleCandidate.status, PleCandidate.created_at)
    )
    if status:
        stmt = stmt.where(PleCandidate.status == status)
    rows = list(await session.scalars(stmt))
    out: list[PleCandidateOut] = []
    for row in rows:
        out.append(await _candidate_out(session, tenant_id, row, year=year, term=term))
    return out


async def list_eligible(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    academic_year_id: UUID | None = None,
) -> list[PleEligibleStudentOut]:
    year, term = await _resolve_year(session, tenant_id, academic_year_id)
    existing_ids = set(
        await session.scalars(
            select(PleCandidate.student_id).where(
                PleCandidate.tenant_id == tenant_id,
                PleCandidate.academic_year_id == year.id,
                PleCandidate.deleted_at.is_(None),
                PleCandidate.status.in_(("nominated", "registered", "completed")),
            )
        )
    )
    stmt = (
        registered_students_stmt(tenant_id, term.id)
        .join(SchoolClass, Student.class_id == SchoolClass.id)
        .where(SchoolClass.level == ClassLevel.P7)
    )
    if existing_ids:
        stmt = stmt.where(Student.id.not_in(existing_ids))
    students = list(await session.scalars(stmt))
    out: list[PleEligibleStudentOut] = []
    for student in students:
        _, class_label, stream_name = await _student_placement(session, tenant_id, student)
        readiness = await _readiness(session, tenant_id, student.id, term)
        out.append(
            PleEligibleStudentOut(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                middle_name=student.middle_name,
                class_label=class_label,
                stream_name=stream_name,
                readiness=readiness,
            )
        )
    return out


async def nominate(
    session: AsyncSession,
    tenant_id: UUID,
    body: PleCandidateNominate,
    *,
    academic_year_id: UUID | None = None,
    nominated_by_user_id: UUID | None = None,
) -> list[PleCandidateOut]:
    year, term = await _resolve_year(session, tenant_id, academic_year_id)
    created: list[PleCandidateOut] = []
    for student_id in body.student_ids:
        await _assert_p7_registered(session, tenant_id, student_id, term)
        existing = await session.scalar(
            select(PleCandidate).where(
                PleCandidate.tenant_id == tenant_id,
                PleCandidate.student_id == student_id,
                PleCandidate.academic_year_id == year.id,
                PleCandidate.deleted_at.is_(None),
            )
        )
        if existing is not None:
            if existing.status in ("nominated", "registered", "completed"):
                raise ConflictError(
                    f"Student {student_id} is already a PLE candidate for this year."
                )
            existing.status = "nominated"
            existing.withdrawn_on = None
            existing.withdrawal_reason = None
            existing.nominated_by_user_id = nominated_by_user_id
            row = existing
        else:
            row = PleCandidate(
                tenant_id=tenant_id,
                student_id=student_id,
                academic_year_id=year.id,
                status="nominated",
                nominated_by_user_id=nominated_by_user_id,
            )
            session.add(row)
        await session.flush()
        created.append(await _candidate_out(session, tenant_id, row, year=year, term=term))
    return created


async def update_candidate(
    session: AsyncSession,
    tenant_id: UUID,
    candidate_id: UUID,
    body: PleCandidateUpdate,
) -> PleCandidateOut:
    row = await session.scalar(
        select(PleCandidate).where(
            PleCandidate.tenant_id == tenant_id,
            PleCandidate.id == candidate_id,
            PleCandidate.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("PLE candidate not found.")

    year = await session.get(AcademicYear, row.academic_year_id)
    if year is None:
        raise NotFoundError("Academic year not found.")
    _, term = await _resolve_year(session, tenant_id, year.id)

    if body.status is not None:
        if body.status not in _VALID_STATUSES:
            raise ValidationError(f"Invalid status: {body.status}")
        allowed = _TRANSITIONS.get(row.status, frozenset())
        if body.status != row.status and body.status not in allowed:
            raise ValidationError(
                f"Cannot change candidate status from {row.status} to {body.status}."
            )
        row.status = body.status
        if body.status == "registered" and body.registered_on is None and row.registered_on is None:
            row.registered_on = dt.date.today()
        if body.status == "withdrawn":
            row.withdrawn_on = body.withdrawn_on or dt.date.today()

    if body.candidate_number is not None:
        row.candidate_number = body.candidate_number.strip() or None
    if body.registered_on is not None:
        row.registered_on = body.registered_on
    if body.withdrawn_on is not None:
        row.withdrawn_on = body.withdrawn_on
    if body.withdrawal_reason is not None:
        row.withdrawal_reason = body.withdrawal_reason.strip() or None
    if body.notes is not None:
        row.notes = body.notes.strip() or None

    await session.flush()
    return await _candidate_out(session, tenant_id, row, year=year, term=term)

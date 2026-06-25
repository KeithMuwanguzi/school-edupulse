"""Assessment — term sets, CA computation, teacher mark entry (Phase 2 §9)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.models.academic import Term
from app.models.assessment import (
    AssessmentSet,
    CaSetInclusion,
    StudentAssessmentMark,
    TermCaPolicy,
)
from app.models.enums import ClassLevel, NcdcCycle
from app.models.grading import AggregateDivision, GradeRange, GradingScale
from app.models.school_class import SchoolClass
from app.models.student import Student
from app.models.subject import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.schemas.assessment import (
    AssessmentSetCreate,
    AssessmentSetOut,
    AssessmentSetUpdate,
    AssessmentSummaryOut,
    CaSetInclusionOut,
    ComputedCaOut,
    MarkEntryRosterOut,
    MarkEntrySaveRequest,
    MarkEntrySaveResponse,
    MarkEntryStudentRow,
    MarksGridCell,
    MarksGridOut,
    MarksGridStudentRow,
    MarksGridSubjectCol,
    MarksImportRequest,
    MarksImportResponse,
    MarksImportRowResult,
    PerformanceSetColumn,
    PerformanceSetMark,
    PerformanceSubject,
    StudentCaSummaryOut,
    StudentPerformanceOut,
    SubjectCaScoreOut,
    TermCaConfigOut,
    TermCaConfigUpdate,
)
from app.services.term_registration_service import _resolve_term
from app.services.term_roster_service import registered_students_stmt

_LEVEL_CYCLE: dict[ClassLevel, NcdcCycle] = {
    ClassLevel.P1: NcdcCycle.cycle_1,
    ClassLevel.P2: NcdcCycle.cycle_1,
    ClassLevel.P3: NcdcCycle.cycle_1,
    ClassLevel.P4: NcdcCycle.cycle_2,
    ClassLevel.P5: NcdcCycle.cycle_3,
    ClassLevel.P6: NcdcCycle.cycle_3,
    ClassLevel.P7: NcdcCycle.cycle_3,
}

_ADMIN_ROLES = frozenset({"school_admin", "deputy_head"})


def _scoring_mode(level: ClassLevel) -> str:
    """All primary levels record numeric marks (percentages).

    Ugandan primary schools record termly exam/CA marks out of 100 for every
    class (P1–P7); letter grades, aggregates and divisions are then derived from
    the admin-configured grading scales. We keep this helper for call sites that
    still branch on mode, but it is numeric everywhere.
    """
    _ = level
    return "numeric"


def _is_admin(role: str) -> bool:
    return role in _ADMIN_ROLES


async def _get_set(
    session: AsyncSession, tenant_id: UUID, set_id: UUID
) -> AssessmentSet:
    row = await session.scalar(
        select(AssessmentSet).where(
            AssessmentSet.tenant_id == tenant_id,
            AssessmentSet.id == set_id,
            AssessmentSet.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Assessment set not found.")
    return row


async def _marks_count(session: AsyncSession, tenant_id: UUID, set_id: UUID) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(StudentAssessmentMark)
        .where(
            StudentAssessmentMark.tenant_id == tenant_id,
            StudentAssessmentMark.set_id == set_id,
        )
    )
    return int(count or 0)


def _set_out(row: AssessmentSet, *, marks_entered: int = 0) -> AssessmentSetOut:
    return AssessmentSetOut(
        id=row.id,
        term_id=row.term_id,
        name=row.name,
        description=row.description,
        max_mark=row.max_mark,
        sort_order=row.sort_order,
        entry_status=row.entry_status,
        marks_entered=marks_entered,
    )


async def list_sets(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
) -> list[AssessmentSetOut]:
    term = await _resolve_term(session, tenant_id, term_id)
    rows = list(
        await session.scalars(
            select(AssessmentSet)
            .where(
                AssessmentSet.tenant_id == tenant_id,
                AssessmentSet.term_id == term.id,
                AssessmentSet.deleted_at.is_(None),
            )
            .order_by(AssessmentSet.sort_order, AssessmentSet.name)
        )
    )
    out: list[AssessmentSetOut] = []
    for row in rows:
        count = await _marks_count(session, tenant_id, row.id)
        out.append(_set_out(row, marks_entered=count))
    return out


async def create_set(
    session: AsyncSession,
    tenant_id: UUID,
    body: AssessmentSetCreate,
) -> AssessmentSetOut:
    term = await _resolve_term(session, tenant_id, body.term_id)
    row = AssessmentSet(
        tenant_id=tenant_id,
        term_id=term.id,
        name=body.name.strip(),
        description=(body.description or None),
        max_mark=body.max_mark,
        sort_order=body.sort_order,
        entry_status="draft",
    )
    session.add(row)
    await session.flush()
    return _set_out(row)


async def update_set(
    session: AsyncSession,
    tenant_id: UUID,
    set_id: UUID,
    body: AssessmentSetUpdate,
) -> AssessmentSetOut:
    row = await _get_set(session, tenant_id, set_id)
    if body.name is not None:
        row.name = body.name.strip()
    if body.description is not None:
        row.description = body.description or None
    if body.max_mark is not None:
        row.max_mark = body.max_mark
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.entry_status is not None:
        row.entry_status = body.entry_status
    await session.flush()
    count = await _marks_count(session, tenant_id, row.id)
    return _set_out(row, marks_entered=count)


async def open_set(
    session: AsyncSession, tenant_id: UUID, set_id: UUID
) -> AssessmentSetOut:
    return await update_set(
        session,
        tenant_id,
        set_id,
        AssessmentSetUpdate(entry_status="open"),
    )


async def close_set(
    session: AsyncSession, tenant_id: UUID, set_id: UUID
) -> AssessmentSetOut:
    return await update_set(
        session,
        tenant_id,
        set_id,
        AssessmentSetUpdate(entry_status="closed"),
    )


async def delete_set(session: AsyncSession, tenant_id: UUID, set_id: UUID) -> None:
    row = await _get_set(session, tenant_id, set_id)
    row.deleted_at = dt.datetime.now(dt.UTC)
    await session.flush()


async def get_ca_config(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
) -> TermCaConfigOut:
    term = await _resolve_term(session, tenant_id, term_id)
    policy = await session.scalar(
        select(TermCaPolicy).where(
            TermCaPolicy.tenant_id == tenant_id,
            TermCaPolicy.term_id == term.id,
        )
    )
    inclusions = list(
        await session.scalars(
            select(CaSetInclusion)
            .where(
                CaSetInclusion.tenant_id == tenant_id,
                CaSetInclusion.term_id == term.id,
            )
            .order_by(CaSetInclusion.sort_order)
        )
    )
    inclusion_out: list[CaSetInclusionOut] = []
    for inc in inclusions:
        aset = await session.scalar(
            select(AssessmentSet).where(
                AssessmentSet.tenant_id == tenant_id,
                AssessmentSet.id == inc.set_id,
                AssessmentSet.deleted_at.is_(None),
            )
        )
        if aset is None:
            continue
        inclusion_out.append(
            CaSetInclusionOut(
                set_id=inc.set_id,
                weight=float(inc.weight),
                sort_order=inc.sort_order,
                set_name=aset.name,
                entry_status=aset.entry_status,
            )
        )
    return TermCaConfigOut(
        term_id=term.id,
        method=policy.method if policy else "average",
        notes=policy.notes if policy else None,
        inclusions=inclusion_out,
    )


async def update_ca_config(
    session: AsyncSession,
    tenant_id: UUID,
    body: TermCaConfigUpdate,
    *,
    term_id: UUID | None = None,
) -> TermCaConfigOut:
    term = await _resolve_term(session, tenant_id, term_id)
    if body.inclusions:
        set_ids = [inc.set_id for inc in body.inclusions]
        valid_count = await session.scalar(
            select(func.count())
            .select_from(AssessmentSet)
            .where(
                AssessmentSet.tenant_id == tenant_id,
                AssessmentSet.term_id == term.id,
                AssessmentSet.id.in_(set_ids),
                AssessmentSet.deleted_at.is_(None),
            )
        )
        if int(valid_count or 0) != len(set_ids):
            raise ValidationError("All CA inclusions must reference sets in this term.")

    policy = await session.scalar(
        select(TermCaPolicy).where(
            TermCaPolicy.tenant_id == tenant_id,
            TermCaPolicy.term_id == term.id,
        )
    )
    if policy is None:
        policy = TermCaPolicy(
            tenant_id=tenant_id,
            term_id=term.id,
            method=body.method,
            notes=body.notes,
        )
        session.add(policy)
    else:
        policy.method = body.method
        policy.notes = body.notes

    existing = list(
        await session.scalars(
            select(CaSetInclusion).where(
                CaSetInclusion.tenant_id == tenant_id,
                CaSetInclusion.term_id == term.id,
            )
        )
    )
    for row in existing:
        await session.delete(row)
    await session.flush()

    for inc in body.inclusions:
        session.add(
            CaSetInclusion(
                tenant_id=tenant_id,
                term_id=term.id,
                set_id=inc.set_id,
                weight=inc.weight,
                sort_order=inc.sort_order,
            )
        )
    await session.flush()
    return await get_ca_config(session, tenant_id, term_id=term.id)


async def assessment_summary(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
) -> AssessmentSummaryOut:
    term = await _resolve_term(session, tenant_id, term_id)
    sets = list(
        await session.scalars(
            select(AssessmentSet).where(
                AssessmentSet.tenant_id == tenant_id,
                AssessmentSet.term_id == term.id,
                AssessmentSet.deleted_at.is_(None),
            )
        )
    )
    total_marks = await session.scalar(
        select(func.count())
        .select_from(StudentAssessmentMark)
        .where(
            StudentAssessmentMark.tenant_id == tenant_id,
            StudentAssessmentMark.term_id == term.id,
        )
    )
    ca_policy = await session.scalar(
        select(TermCaPolicy).where(
            TermCaPolicy.tenant_id == tenant_id,
            TermCaPolicy.term_id == term.id,
        )
    )
    ca_inclusions = 0
    if ca_policy:
        ca_inclusions = int(
            await session.scalar(
                select(func.count())
                .select_from(CaSetInclusion)
                .where(
                    CaSetInclusion.tenant_id == tenant_id,
                    CaSetInclusion.term_id == term.id,
                )
            )
            or 0
        )
    return AssessmentSummaryOut(
        term_id=term.id,
        term_label=term.label,
        total_sets=len(sets),
        open_sets=sum(1 for s in sets if s.entry_status == "open"),
        closed_sets=sum(1 for s in sets if s.entry_status == "closed"),
        total_marks=int(total_marks or 0),
        ca_configured=ca_inclusions > 0,
    )


async def _teacher_assigned(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    teacher_user_id: UUID,
    class_id: UUID,
    subject_id: UUID,
    term_id: UUID,
) -> bool:
    term = await session.get(Term, term_id)
    if term is None:
        return False
    stmt = select(TeacherAssignment.id).where(
        TeacherAssignment.tenant_id == tenant_id,
        TeacherAssignment.teacher_user_id == teacher_user_id,
        TeacherAssignment.class_id == class_id,
        TeacherAssignment.subject_id == subject_id,
        TeacherAssignment.academic_year_id == term.academic_year_id,
        TeacherAssignment.deleted_at.is_(None),
        or_(
            TeacherAssignment.term_id == term_id,
            TeacherAssignment.term_id.is_(None),
        ),
    )
    return (await session.scalar(stmt)) is not None


async def _subjects_for_class(
    session: AsyncSession, tenant_id: UUID, level: ClassLevel
) -> list[Subject]:
    cycle = _LEVEL_CYCLE[level]
    rows = await session.scalars(
        select(Subject)
        .where(
            Subject.tenant_id == tenant_id,
            Subject.deleted_at.is_(None),
            Subject.is_active.is_(True),
        )
        .order_by(Subject.sort_order, Subject.name)
    )
    return [subject for subject in rows if cycle in subject.ncdc_cycles]


async def get_mark_entry_roster(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    set_id: UUID,
    class_id: UUID,
    subject_id: UUID,
    stream_id: UUID | None,
    user_id: UUID,
    role: str,
) -> MarkEntryRosterOut:
    aset = await _get_set(session, tenant_id, set_id)
    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")

    subject = await session.scalar(
        select(Subject).where(
            Subject.tenant_id == tenant_id,
            Subject.id == subject_id,
            Subject.deleted_at.is_(None),
        )
    )
    if subject is None:
        raise NotFoundError("Subject not found.")

    can_edit = False
    if _is_admin(role):
        can_edit = False
    elif role == "teacher":
        if aset.entry_status != "open":
            can_edit = False
        else:
            can_edit = await _teacher_assigned(
                session,
                tenant_id,
                teacher_user_id=user_id,
                class_id=class_id,
                subject_id=subject_id,
                term_id=aset.term_id,
            )
            if not can_edit:
                raise ForbiddenError("You are not assigned to teach this subject in this class.")

    stmt = registered_students_stmt(
        tenant_id, aset.term_id, class_id=class_id, stream_id=stream_id
    )
    students = list(await session.scalars(stmt))

    existing = {
        (m.student_id): m
        for m in await session.scalars(
            select(StudentAssessmentMark).where(
                StudentAssessmentMark.tenant_id == tenant_id,
                StudentAssessmentMark.set_id == set_id,
                StudentAssessmentMark.subject_id == subject_id,
                StudentAssessmentMark.student_id.in_([s.id for s in students])
                if students
                else False,
            )
        )
    }

    rows: list[MarkEntryStudentRow] = []
    for student in students:
        mark = existing.get(student.id)
        score = float(mark.score) if mark and mark.score is not None else None
        rows.append(
            MarkEntryStudentRow(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                middle_name=student.middle_name,
                score=score,
                competence_level=mark.competence_level if mark else None,
                remark=mark.remark if mark else None,
            )
        )

    class_label = school_class.label or school_class.level.value
    return MarkEntryRosterOut(
        set_id=aset.id,
        set_name=aset.name,
        max_mark=aset.max_mark,
        entry_status=aset.entry_status,
        term_id=aset.term_id,
        class_id=class_id,
        class_label=class_label,
        class_level=school_class.level.value,
        subject_id=subject_id,
        subject_name=subject.name,
        scoring_mode=_scoring_mode(school_class.level),
        can_edit=can_edit,
        students=rows,
    )


async def save_marks(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    user_id: UUID,
    role: str,
    body: MarkEntrySaveRequest,
) -> MarkEntrySaveResponse:
    if role != "teacher":
        raise ForbiddenError("Only teachers can record assessment marks.")

    aset = await _get_set(session, tenant_id, body.set_id)
    if aset.entry_status != "open":
        raise ValidationError("This assessment set is not open for mark entry.")

    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == body.class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")

    assigned = await _teacher_assigned(
        session,
        tenant_id,
        teacher_user_id=user_id,
        class_id=body.class_id,
        subject_id=body.subject_id,
        term_id=aset.term_id,
    )
    if not assigned:
        raise ForbiddenError("You are not assigned to teach this subject in this class.")

    mode = _scoring_mode(school_class.level)
    student_ids = [m.student_id for m in body.marks]
    roster_stmt = registered_students_stmt(
        tenant_id,
        aset.term_id,
        class_id=body.class_id,
        stream_id=body.stream_id,
    ).where(Student.id.in_(student_ids))
    valid_students = set(await session.scalars(roster_stmt))
    if len(valid_students) != len(set(student_ids)):
        raise ValidationError("All marks must be for registered students in this class.")

    saved = 0
    now = dt.datetime.now(dt.UTC)
    for item in body.marks:
        if mode == "numeric":
            if item.score is None:
                continue
            if item.score < 0 or item.score > aset.max_mark:
                raise ValidationError(
                    f"Score must be between 0 and {aset.max_mark} for numeric assessment."
                )
            competence = None
            score = item.score
        else:
            if not item.competence_level:
                continue
            score = None
            competence = item.competence_level

        existing = await session.scalar(
            select(StudentAssessmentMark).where(
                StudentAssessmentMark.tenant_id == tenant_id,
                StudentAssessmentMark.set_id == body.set_id,
                StudentAssessmentMark.student_id == item.student_id,
                StudentAssessmentMark.subject_id == body.subject_id,
            )
        )
        if existing is None:
            existing = StudentAssessmentMark(
                tenant_id=tenant_id,
                term_id=aset.term_id,
                set_id=body.set_id,
                student_id=item.student_id,
                subject_id=body.subject_id,
            )
            session.add(existing)
        existing.score = score
        existing.competence_level = competence
        existing.remark = (item.remark or None)
        existing.entered_by_user_id = user_id
        existing.entered_at = now
        saved += 1

    await session.flush()
    return MarkEntrySaveResponse(
        saved=saved,
        set_id=body.set_id,
        subject_id=body.subject_id,
    )


def _normalize_name(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


async def import_marks(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    user_id: UUID,
    role: str,
    body: MarksImportRequest,
) -> MarksImportResponse:
    """Bulk import a subject's marks for a class from a spreadsheet.

    Mirrors the manual save rules: teacher-only, set must be open, teacher must
    be assigned, and only fully term-registered pupils are accepted. Rows for
    pupils who are not onboarded for the term are skipped with a warning rather
    than failing the whole import.
    """
    if role != "teacher":
        raise ForbiddenError("Only teachers can import assessment marks.")

    aset = await _get_set(session, tenant_id, body.set_id)
    if aset.entry_status != "open":
        raise ValidationError("This assessment set is not open for mark entry.")

    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == body.class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")

    assigned = await _teacher_assigned(
        session,
        tenant_id,
        teacher_user_id=user_id,
        class_id=body.class_id,
        subject_id=body.subject_id,
        term_id=aset.term_id,
    )
    if not assigned:
        raise ForbiddenError("You are not assigned to teach this subject in this class.")

    registered = list(
        await session.scalars(
            registered_students_stmt(
                tenant_id, aset.term_id, class_id=body.class_id, stream_id=body.stream_id
            )
        )
    )
    by_number = {s.student_number.strip().lower(): s for s in registered}
    by_name: dict[str, list[Student]] = {}
    for s in registered:
        key = _normalize_name(f"{s.first_name} {s.last_name}")
        by_name.setdefault(key, []).append(s)

    # Active pupils in the class who are NOT registered yet (for clearer messages).
    all_active = list(
        await session.scalars(
            select(Student).where(
                Student.tenant_id == tenant_id,
                Student.class_id == body.class_id,
                Student.deleted_at.is_(None),
                Student.is_active.is_(True),
            )
        )
    )
    registered_ids = {s.id for s in registered}
    unregistered_numbers = {
        s.student_number.strip().lower()
        for s in all_active
        if s.id not in registered_ids
    }
    unregistered_names = {
        _normalize_name(f"{s.first_name} {s.last_name}")
        for s in all_active
        if s.id not in registered_ids
    }

    results: list[MarksImportRowResult] = []
    valid = skipped = failed = imported = 0
    now = dt.datetime.now(dt.UTC)
    seen_student_ids: set[UUID] = set()

    for idx, row in enumerate(body.rows, start=1):
        number_key = (row.student_number or "").strip().lower()
        name_key = _normalize_name(f"{row.first_name or ''} {row.last_name or ''}")
        identifier = (
            row.student_number
            or f"{(row.first_name or '').strip()} {(row.last_name or '').strip()}".strip()
            or f"row {idx}"
        )

        matched: Student | None = None
        if number_key and number_key in by_number:
            matched = by_number[number_key]
        elif name_key and name_key in by_name and len(by_name[name_key]) == 1:
            matched = by_name[name_key][0]

        if matched is None:
            if number_key in unregistered_numbers or name_key in unregistered_names:
                msg = "Pupil is not fully onboarded for this term — skipped."
            elif name_key and name_key in by_name and len(by_name[name_key]) > 1:
                msg = "Multiple pupils share this name — add the pupil number."
            else:
                msg = "No matching registered pupil found in this class."
            results.append(
                MarksImportRowResult(
                    line=idx, identifier=identifier, status="skipped", message=msg
                )
            )
            skipped += 1
            continue

        if matched.id in seen_student_ids:
            results.append(
                MarksImportRowResult(
                    line=idx,
                    identifier=identifier,
                    matched_student_id=matched.id,
                    status="failed",
                    message="Duplicate row for this pupil in the sheet.",
                )
            )
            failed += 1
            continue

        if row.score is None:
            results.append(
                MarksImportRowResult(
                    line=idx,
                    identifier=identifier,
                    matched_student_id=matched.id,
                    status="skipped",
                    message="No score provided — skipped.",
                )
            )
            skipped += 1
            continue

        if row.score < 0 or row.score > aset.max_mark:
            results.append(
                MarksImportRowResult(
                    line=idx,
                    identifier=identifier,
                    matched_student_id=matched.id,
                    status="failed",
                    message=f"Score must be between 0 and {aset.max_mark}.",
                    score=row.score,
                )
            )
            failed += 1
            continue

        seen_student_ids.add(matched.id)
        valid += 1
        result_status = "valid"

        if not body.dry_run:
            existing = await session.scalar(
                select(StudentAssessmentMark).where(
                    StudentAssessmentMark.tenant_id == tenant_id,
                    StudentAssessmentMark.set_id == body.set_id,
                    StudentAssessmentMark.student_id == matched.id,
                    StudentAssessmentMark.subject_id == body.subject_id,
                )
            )
            if existing is None:
                existing = StudentAssessmentMark(
                    tenant_id=tenant_id,
                    term_id=aset.term_id,
                    set_id=body.set_id,
                    student_id=matched.id,
                    subject_id=body.subject_id,
                )
                session.add(existing)
            existing.score = row.score
            existing.competence_level = None
            existing.remark = row.remark or None
            existing.entered_by_user_id = user_id
            existing.entered_at = now
            imported += 1
            result_status = "imported"

        results.append(
            MarksImportRowResult(
                line=idx,
                identifier=identifier,
                matched_student_id=matched.id,
                status=result_status,
                score=row.score,
            )
        )

    if not body.dry_run:
        await session.flush()

    return MarksImportResponse(
        set_id=body.set_id,
        subject_id=body.subject_id,
        imported=imported,
        valid=valid,
        skipped=skipped,
        failed=failed,
        results=results,
    )


def _competence_rank(level: str | None) -> int:
    order = {"emerging": 1, "developing": 2, "proficient": 3, "excellent": 4}
    return order.get((level or "").lower(), 0)


def _dominant_competence(levels: list[str]) -> str | None:
    filtered = [lv for lv in levels if lv]
    if not filtered:
        return None
    return max(filtered, key=_competence_rank)


async def _scale_for_subject(
    session: AsyncSession,
    tenant_id: UUID,
    subject: Subject,
    level: ClassLevel,
) -> GradingScale | None:
    """Grade scale for a subject: its own assignment, else the cycle default."""
    if subject.grading_scale_id is not None:
        scale = await session.scalar(
            select(GradingScale).where(
                GradingScale.tenant_id == tenant_id,
                GradingScale.id == subject.grading_scale_id,
                GradingScale.deleted_at.is_(None),
            )
        )
        if scale is not None:
            return scale
    cycle = _LEVEL_CYCLE[level]
    return await session.scalar(
        select(GradingScale)
        .where(
            GradingScale.tenant_id == tenant_id,
            GradingScale.ncdc_cycle == cycle,
            GradingScale.deleted_at.is_(None),
        )
        .order_by(GradingScale.sort_order, GradingScale.name)
        .limit(1)
    )


async def _grade_for_score(
    session: AsyncSession,
    tenant_id: UUID,
    scale_id: UUID,
    mark: int,
) -> GradeRange | None:
    return await session.scalar(
        select(GradeRange)
        .where(
            GradeRange.tenant_id == tenant_id,
            GradeRange.scale_id == scale_id,
            GradeRange.deleted_at.is_(None),
            GradeRange.is_active.is_(True),
            GradeRange.min_mark <= mark,
            GradeRange.max_mark >= mark,
        )
        .order_by(GradeRange.sort_order, GradeRange.aggregate_weight)
        .limit(1)
    )


async def _division_for_aggregate(
    session: AsyncSession,
    tenant_id: UUID,
    aggregate: int,
) -> AggregateDivision | None:
    return await session.scalar(
        select(AggregateDivision)
        .where(
            AggregateDivision.tenant_id == tenant_id,
            AggregateDivision.deleted_at.is_(None),
            AggregateDivision.is_active.is_(True),
            AggregateDivision.min_aggregate <= aggregate,
            AggregateDivision.max_aggregate >= aggregate,
        )
        .order_by(AggregateDivision.sort_order, AggregateDivision.min_aggregate)
        .limit(1)
    )


async def _subjects_for_class_with_marks(
    session: AsyncSession,
    tenant_id: UUID,
    class_level: ClassLevel,
    *,
    term_id: UUID,
    student_ids: list[UUID],
) -> list[Subject]:
    by_id = {s.id: s for s in await _subjects_for_class(session, tenant_id, class_level)}
    if not student_ids:
        return list(by_id.values())
    extra_ids = await session.scalars(
        select(StudentAssessmentMark.subject_id)
        .where(
            StudentAssessmentMark.tenant_id == tenant_id,
            StudentAssessmentMark.term_id == term_id,
            StudentAssessmentMark.student_id.in_(student_ids),
        )
        .distinct()
    )
    for subject_id in extra_ids:
        if subject_id in by_id:
            continue
        subject = await session.scalar(
            select(Subject).where(
                Subject.tenant_id == tenant_id,
                Subject.id == subject_id,
                Subject.deleted_at.is_(None),
            )
        )
        if subject is not None:
            by_id[subject.id] = subject
    return sorted(by_id.values(), key=lambda s: (s.sort_order, s.name))


async def _ca_set_weights(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID,
    student_id: UUID,
    subject_id: UUID,
    config: TermCaConfigOut,
) -> tuple[list[UUID], dict[UUID, float], bool]:
    """Return set IDs and weights for CA. Falls back to all recorded sets when CA is unconfigured."""
    if config.inclusions:
        set_ids = [inc.set_id for inc in config.inclusions]
        weight_map = {inc.set_id: inc.weight for inc in config.inclusions}
        return set_ids, weight_map, False

    mark_set_ids = list(
        await session.scalars(
            select(StudentAssessmentMark.set_id)
            .where(
                StudentAssessmentMark.tenant_id == tenant_id,
                StudentAssessmentMark.term_id == term_id,
                StudentAssessmentMark.student_id == student_id,
                StudentAssessmentMark.subject_id == subject_id,
            )
            .distinct()
        )
    )
    weight_map = {sid: 1.0 for sid in mark_set_ids}
    return mark_set_ids, weight_map, True


async def get_marks_grid(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    set_id: UUID,
    class_id: UUID,
    stream_id: UUID | None = None,
    term_id: UUID | None = None,
) -> MarksGridOut:
    aset = await _get_set(session, tenant_id, set_id)
    term = await _resolve_term(session, tenant_id, term_id or aset.term_id)
    if aset.term_id != term.id:
        raise ValidationError("Assessment set does not belong to the active term.")

    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")

    students = list(
        await session.scalars(
            registered_students_stmt(
                tenant_id, term.id, class_id=class_id, stream_id=stream_id
            )
        )
    )
    student_ids = [s.id for s in students]
    subjects = await _subjects_for_class_with_marks(
        session,
        tenant_id,
        school_class.level,
        term_id=term.id,
        student_ids=student_ids,
    )

    marks_stmt = select(StudentAssessmentMark).where(
        StudentAssessmentMark.tenant_id == tenant_id,
        StudentAssessmentMark.set_id == set_id,
    )
    if student_ids:
        marks_stmt = marks_stmt.where(
            StudentAssessmentMark.student_id.in_(student_ids)
        )
    marks = list(await session.scalars(marks_stmt))
    mark_map = {(m.student_id, m.subject_id): m for m in marks}
    mode = _scoring_mode(school_class.level)

    subject_cols = [
        MarksGridSubjectCol(
            subject_id=s.id, subject_code=s.code, subject_name=s.name
        )
        for s in subjects
    ]
    rows: list[MarksGridStudentRow] = []
    for student in students:
        cells: list[MarksGridCell] = []
        for subject in subjects:
            mark = mark_map.get((student.id, subject.id))
            if mark is None:
                cells.append(MarksGridCell(subject_id=subject.id, display="—"))
            elif mode == "competency":
                cells.append(
                    MarksGridCell(
                        subject_id=subject.id,
                        competence_level=mark.competence_level,
                        display=(
                            mark.competence_level.replace("_", " ").title()
                            if mark.competence_level
                            else "—"
                        ),
                    )
                )
            else:
                score = float(mark.score) if mark.score is not None else None
                cells.append(
                    MarksGridCell(
                        subject_id=subject.id,
                        score=score,
                        display=(
                            f"{score:g}/{aset.max_mark}"
                            if score is not None
                            else "—"
                        ),
                    )
                )
        rows.append(
            MarksGridStudentRow(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                cells=cells,
            )
        )

    return MarksGridOut(
        set_id=aset.id,
        set_name=aset.name,
        max_mark=aset.max_mark,
        class_id=class_id,
        class_level=school_class.level.value,
        scoring_mode=mode,
        subjects=subject_cols,
        students=rows,
    )


async def compute_subject_ca(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_id: UUID,
    subject_id: UUID,
    term_id: UUID,
    class_level: ClassLevel,
) -> SubjectCaScoreOut:
    subject = await session.get(Subject, subject_id)
    if subject is None:
        raise NotFoundError("Subject not found.")

    config = await get_ca_config(session, tenant_id, term_id=term_id)
    set_ids, weight_map, _ = await _ca_set_weights(
        session,
        tenant_id,
        term_id=term_id,
        student_id=student_id,
        subject_id=subject_id,
        config=config,
    )
    if not set_ids:
        return SubjectCaScoreOut(
            subject_id=subject_id,
            subject_code=subject.code,
            subject_name=subject.name,
            is_core=subject.is_core,
            status="pending",
        )

    sets = {
        row.id: row
        for row in await session.scalars(
            select(AssessmentSet).where(
                AssessmentSet.tenant_id == tenant_id,
                AssessmentSet.id.in_(set_ids),
                AssessmentSet.deleted_at.is_(None),
            )
        )
    }

    marks = list(
        await session.scalars(
            select(StudentAssessmentMark).where(
                StudentAssessmentMark.tenant_id == tenant_id,
                StudentAssessmentMark.term_id == term_id,
                StudentAssessmentMark.student_id == student_id,
                StudentAssessmentMark.subject_id == subject_id,
                StudentAssessmentMark.set_id.in_(set_ids),
            )
        )
    )

    percentages: list[float] = []
    weights: list[float] = []
    for mark in marks:
        aset = sets.get(mark.set_id)
        if aset is None or mark.score is None or aset.max_mark <= 0:
            continue
        pct = (float(mark.score) / aset.max_mark) * 100.0
        percentages.append(pct)
        weights.append(float(weight_map.get(mark.set_id, 1.0)))

    if not percentages:
        return SubjectCaScoreOut(
            subject_id=subject_id,
            subject_code=subject.code,
            subject_name=subject.name,
            is_core=subject.is_core,
            status="pending",
        )

    if config.method == "weighted_average" and weights and config.inclusions:
        total_w = sum(weights)
        ca = sum(p * w for p, w in zip(percentages, weights, strict=True)) / total_w
    else:
        ca = sum(percentages) / len(percentages)

    ca_rounded = round(ca, 1)
    grade_label: str | None = None
    aggregate_points: int | None = None
    scale = await _scale_for_subject(session, tenant_id, subject, class_level)
    if scale is not None:
        band = await _grade_for_score(
            session, tenant_id, scale.id, int(round(ca))
        )
        if band is not None:
            grade_label = band.label
            aggregate_points = band.aggregate_weight

    return SubjectCaScoreOut(
        subject_id=subject_id,
        subject_code=subject.code,
        subject_name=subject.name,
        is_core=subject.is_core,
        ca_score=ca_rounded,
        grade_label=grade_label,
        aggregate_points=aggregate_points,
        sets_used=len(percentages),
        status="computed",
    )


async def compute_class_ca(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    class_id: UUID,
    stream_id: UUID | None = None,
    term_id: UUID | None = None,
) -> ComputedCaOut:
    term = await _resolve_term(session, tenant_id, term_id)
    config = await get_ca_config(session, tenant_id, term_id=term.id)

    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")

    students = list(
        await session.scalars(
            registered_students_stmt(
                tenant_id, term.id, class_id=class_id, stream_id=stream_id
            )
        )
    )
    subjects = await _subjects_for_class_with_marks(
        session,
        tenant_id,
        school_class.level,
        term_id=term.id,
        student_ids=[s.id for s in students],
    )

    ca_configured = bool(config.inclusions)
    using_fallback = False
    student_rows: list[StudentCaSummaryOut] = []
    for student in students:
        subject_scores: list[SubjectCaScoreOut] = []
        for subject in subjects:
            _, _, used_fallback = await _ca_set_weights(
                session,
                tenant_id,
                term_id=term.id,
                student_id=student.id,
                subject_id=subject.id,
                config=config,
            )
            if used_fallback:
                using_fallback = True
            subject_scores.append(
                await compute_subject_ca(
                    session,
                    tenant_id,
                    student_id=student.id,
                    subject_id=subject.id,
                    term_id=term.id,
                    class_level=school_class.level,
                )
            )
        average, aggregate, division_label, scored = await _summarize_student(
            session, tenant_id, subject_scores
        )
        student_rows.append(
            StudentCaSummaryOut(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                subjects=subject_scores,
                average_score=average,
                aggregate=aggregate,
                division_label=division_label,
                subjects_scored=scored,
            )
        )

    return ComputedCaOut(
        term_id=term.id,
        class_id=class_id,
        method=config.method,
        ca_configured=ca_configured,
        using_all_recorded_sets=using_fallback and not ca_configured,
        registered_count=len(students),
        students=student_rows,
    )


async def _summarize_student(
    session: AsyncSession,
    tenant_id: UUID,
    subject_scores: list[SubjectCaScoreOut],
) -> tuple[float | None, int | None, str | None, int]:
    """Roll subject scores into term average, aggregate (core subjects), division."""
    scores = [s.ca_score for s in subject_scores if s.ca_score is not None]
    average = round(sum(scores) / len(scores), 1) if scores else None

    core_points = [
        s.aggregate_points
        for s in subject_scores
        if s.is_core and s.aggregate_points is not None
    ]
    all_points = [
        s.aggregate_points for s in subject_scores if s.aggregate_points is not None
    ]
    points = core_points or all_points
    aggregate: int | None = sum(points) if points else None

    division_label: str | None = None
    if aggregate is not None:
        division = await _division_for_aggregate(session, tenant_id, aggregate)
        division_label = division.label if division else None

    return average, aggregate, division_label, len(scores)


async def student_performance(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_id: UUID,
    term_id: UUID | None = None,
) -> StudentPerformanceOut:
    """Per-term performance for one pupil: subjects × sets, CA, grade, division."""
    term = await _resolve_term(session, tenant_id, term_id)
    student = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.id == student_id,
            Student.deleted_at.is_(None),
        )
    )
    if student is None:
        raise NotFoundError("Student not found.")
    if student.class_id is None:
        raise ValidationError("Assign the pupil to a class to view performance.")

    school_class = await session.get(SchoolClass, student.class_id)
    if school_class is None:
        raise NotFoundError("Class not found.")

    class_label = school_class.label or school_class.level.value
    subjects = await _subjects_for_class(session, tenant_id, school_class.level)

    # All term sets, ordered, used as columns.
    sets = list(
        await session.scalars(
            select(AssessmentSet)
            .where(
                AssessmentSet.tenant_id == tenant_id,
                AssessmentSet.term_id == term.id,
                AssessmentSet.deleted_at.is_(None),
            )
            .order_by(AssessmentSet.sort_order, AssessmentSet.name)
        )
    )
    set_by_id = {s.id: s for s in sets}

    marks = list(
        await session.scalars(
            select(StudentAssessmentMark).where(
                StudentAssessmentMark.tenant_id == tenant_id,
                StudentAssessmentMark.term_id == term.id,
                StudentAssessmentMark.student_id == student_id,
            )
        )
    )
    mark_map = {(m.subject_id, m.set_id): m for m in marks}

    subject_rows: list[PerformanceSubject] = []
    subject_scores: list[SubjectCaScoreOut] = []
    marks_available = False
    for subject in subjects:
        ca = await compute_subject_ca(
            session,
            tenant_id,
            student_id=student_id,
            subject_id=subject.id,
            term_id=term.id,
            class_level=school_class.level,
        )
        subject_scores.append(ca)
        if ca.status == "computed":
            marks_available = True
        set_marks: list[PerformanceSetMark] = []
        for aset in sets:
            mark = mark_map.get((subject.id, aset.id))
            score = (
                float(mark.score) if mark and mark.score is not None else None
            )
            pct = (
                round((score / aset.max_mark) * 100.0, 1)
                if score is not None and aset.max_mark > 0
                else None
            )
            set_marks.append(
                PerformanceSetMark(
                    set_id=aset.id,
                    set_name=aset.name,
                    max_mark=aset.max_mark,
                    score=score,
                    percentage=pct,
                )
            )
        subject_rows.append(
            PerformanceSubject(
                subject_id=subject.id,
                subject_code=subject.code,
                subject_name=subject.name,
                is_core=subject.is_core,
                ca_score=ca.ca_score,
                grade_label=ca.grade_label,
                aggregate_points=ca.aggregate_points,
                status=ca.status,
                set_marks=set_marks,
            )
        )

    average, aggregate, division_label, _ = await _summarize_student(
        session, tenant_id, subject_scores
    )

    return StudentPerformanceOut(
        student_id=student.id,
        student_number=student.student_number,
        first_name=student.first_name,
        last_name=student.last_name,
        middle_name=student.middle_name,
        class_label=class_label,
        class_level=school_class.level.value,
        term_id=term.id,
        term_label=term.label,
        set_columns=[
            PerformanceSetColumn(
                set_id=s.id, set_name=s.name, max_mark=s.max_mark
            )
            for s in set_by_id.values()
        ],
        subjects=subject_rows,
        average_score=average,
        aggregate=aggregate,
        division_label=division_label,
        marks_available=marks_available,
    )


async def student_term_summary(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term_id: UUID,
) -> tuple[float | None, int | None, str | None]:
    """Term roll-up for one student: (average %, aggregate, division label)."""
    student = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.id == student_id,
            Student.deleted_at.is_(None),
        )
    )
    if student is None or student.class_id is None:
        return None, None, None
    school_class = await session.get(SchoolClass, student.class_id)
    if school_class is None:
        return None, None, None

    subjects = await _subjects_for_class(session, tenant_id, school_class.level)
    subject_scores: list[SubjectCaScoreOut] = []
    for subject in subjects:
        subject_scores.append(
            await compute_subject_ca(
                session,
                tenant_id,
                student_id=student_id,
                subject_id=subject.id,
                term_id=term_id,
                class_level=school_class.level,
            )
        )
    average, aggregate, division_label, _ = await _summarize_student(
        session, tenant_id, subject_scores
    )
    return average, aggregate, division_label


async def student_term_average_mark(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term_id: UUID,
) -> float | None:
    """Average CA score across a student's subjects for the term."""
    average, _, _ = await student_term_summary(
        session, tenant_id, student_id, term_id
    )
    return average

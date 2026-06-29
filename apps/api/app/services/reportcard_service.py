"""Report card previews — Phase 2 §10 (marks stub until §9 CA)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.core.report_card_defaults import merge_report_card_layout
from app.models.academic import AcademicYear, Term
from app.models.assessment import (
    AssessmentSet,
    CaSetInclusion,
    StudentAssessmentMark,
)
from app.models.attendance import AttendanceRecord
from app.core.school_levels import LEVEL_CYCLE, assessment_mode, level_section
from app.models.enums import AttendanceStatus, ClassLevel, NcdcCycle
from app.models.grading import AggregateDivision, GradeRange, GradingScale, SubjectGradingAssignment
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.student import Student
from app.models.subject import Subject
from app.models.term_registration import StudentTermRegistration
from app.schemas.reportcard import (
    ReportCardAssessmentSet,
    ReportCardAttendanceOut,
    ReportCardClassOption,
    ReportCardFooterOut,
    ReportCardGradeKey,
    ReportCardLayoutOut,
    ReportCardPreviewOut,
    ReportCardSchoolBranding,
    ReportCardSetScore,
    ReportCardStudentOut,
    ReportCardSubjectLine,
    ReportCardTermOut,
)
from app.services import assessment_service, school_badge_service
from app.services.term_registration_service import _resolve_term, _student_placement
from app.services.term_roster_service import registered_students_stmt

async def _grading_key(
    session: AsyncSession,
    tenant_id: UUID,
    scale: GradingScale | None,
) -> list[ReportCardGradeKey]:
    if scale is None:
        return []
    rows = list(
        await session.scalars(
            select(GradeRange)
            .where(
                GradeRange.tenant_id == tenant_id,
                GradeRange.scale_id == scale.id,
                GradeRange.deleted_at.is_(None),
                GradeRange.is_active.is_(True),
            )
            .order_by(GradeRange.sort_order, GradeRange.aggregate_weight)
        )
    )
    return [
        ReportCardGradeKey(
            label=row.label,
            min_mark=row.min_mark,
            max_mark=row.max_mark,
            aggregate_points=row.aggregate_weight,
        )
        for row in rows
    ]


async def _primary_scale_for_cycle(
    session: AsyncSession,
    tenant_id: UUID,
    cycle: NcdcCycle,
    subjects: list[Subject],
) -> GradingScale | None:
    if subjects:
        rows = list(
            await session.scalars(
                select(SubjectGradingAssignment).where(
                    SubjectGradingAssignment.tenant_id == tenant_id,
                    SubjectGradingAssignment.ncdc_cycle == cycle,
                    SubjectGradingAssignment.subject_id.in_([s.id for s in subjects]),
                )
            )
        )
        if rows:
            counts: dict[UUID, int] = {}
            for row in rows:
                counts[row.grading_scale_id] = counts.get(row.grading_scale_id, 0) + 1
            primary_id = max(counts, key=counts.get)
            return await session.scalar(
                select(GradingScale).where(
                    GradingScale.tenant_id == tenant_id,
                    GradingScale.id == primary_id,
                    GradingScale.deleted_at.is_(None),
                )
            )

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


async def _grade_range_for_mark(
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


async def _student_term_average_mark(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term_id: UUID,
) -> float | None:
    return await assessment_service.student_term_average_mark(
        session, tenant_id, student_id, term_id
    )


async def _student_term_aggregate(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term_id: UUID,
) -> int | None:
    _, aggregate, _ = await assessment_service.student_term_summary(
        session, tenant_id, student_id, term_id
    )
    return aggregate


async def _resolve_report_comments(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_id: UUID,
    term: Term,
    school_class: SchoolClass,
    subjects: list[Subject],
    assessment_mode: str,
    marks_available: bool,
) -> tuple[str | None, str | None, str | None, str]:
    cycle = LEVEL_CYCLE[school_class.level]
    scale = await _primary_scale_for_cycle(session, tenant_id, cycle, subjects)
    if scale is None:
        return None, None, None, "no_scale"

    if not marks_available:
        return None, None, None, "pending_marks"

    # Prefer division-based comments (aggregate of core subjects) when the school
    # has configured aggregate divisions — applies to all levels, with PLE (P7)
    # being the canonical case. Fall back to the average grade band otherwise.
    aggregate = await _student_term_aggregate(session, tenant_id, student_id, term.id)
    if aggregate is not None:
        division = await _division_for_aggregate(session, tenant_id, aggregate)
        if division is not None:
            return (
                division.class_teacher_comment,
                division.head_teacher_comment,
                division.label,
                "resolved",
            )
        if assessment_mode == "ple":
            return None, None, None, "no_band"

    average = await _student_term_average_mark(session, tenant_id, student_id, term.id)
    if average is None:
        return None, None, None, "pending_marks"

    band = await _grade_range_for_mark(
        session, tenant_id, scale.id, int(round(average))
    )
    if band is None:
        return None, None, None, "no_band"
    return (
        None,
        None,
        band.label,
        "resolved",
    )


async def _report_footer(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    school: School,
    term: Term,
) -> ReportCardFooterOut:
    next_term = await session.scalar(
        select(Term)
        .where(
            Term.tenant_id == tenant_id,
            Term.academic_year_id == term.academic_year_id,
            Term.term_number > term.term_number,
        )
        .order_by(Term.term_number)
        .limit(1)
    )
    if next_term is None:
        next_term = await session.scalar(
            select(Term)
            .join(AcademicYear, Term.academic_year_id == AcademicYear.id)
            .where(
                Term.tenant_id == tenant_id,
                AcademicYear.tenant_id == tenant_id,
                Term.starts_on.is_not(None),
                Term.starts_on > (term.starts_on or dt.date.min),
            )
            .order_by(Term.starts_on)
            .limit(1)
        )

    term_fees_summary: str | None = None
    try:
        from app.models.finance import FeeStructure, FeeStructureLine

        structure = await session.scalar(
            select(FeeStructure).where(
                FeeStructure.tenant_id == tenant_id,
                FeeStructure.term_id == term.id,
                FeeStructure.status == "active",
            )
        )
        if structure is not None:
            lines = list(
                await session.scalars(
                    select(FeeStructureLine).where(
                        FeeStructureLine.tenant_id == tenant_id,
                        FeeStructureLine.structure_id == structure.id,
                    )
                )
            )
            if lines:
                total = sum(int(line.amount_ugx) for line in lines)
                term_fees_summary = f"Term fees: {total:,}/=".replace(",", ",")
    except Exception:
        term_fees_summary = None

    return ReportCardFooterOut(
        next_term_label=next_term.label if next_term else None,
        next_term_starts_on=next_term.starts_on if next_term else None,
        next_term_note=school.report_next_term_note,
        requirements_text=school.report_footer_notes,
        term_fees_summary=term_fees_summary,
    )


async def list_class_options(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
) -> tuple[list[ReportCardClassOption], Term]:
    term = await _resolve_term(session, tenant_id, term_id)
    year = await session.get(AcademicYear, term.academic_year_id)
    classes = list(
        await session.scalars(
            select(SchoolClass)
            .where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.deleted_at.is_(None),
                SchoolClass.is_active.is_(True),
            )
            .order_by(SchoolClass.sort_order, SchoolClass.label)
        )
    )
    options: list[ReportCardClassOption] = []
    for school_class in classes:
        count = int(
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
        options.append(
            ReportCardClassOption(
                class_id=school_class.id,
                class_label=school_class.label,
                level=school_class.level.value,
                registered_count=count,
            )
        )
    _ = year
    return options, term


async def _subjects_for_level(
    session: AsyncSession, tenant_id: UUID, level: ClassLevel
) -> list[Subject]:
    cycle = LEVEL_CYCLE[level]
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


async def _attendance_summary(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term: Term,
) -> ReportCardAttendanceOut | None:
    if term.starts_on is None or term.ends_on is None:
        return None
    rows = list(
        await session.execute(
            select(AttendanceRecord.attendance_date, AttendanceRecord.status).where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.student_id == student_id,
                AttendanceRecord.attendance_date >= term.starts_on,
                AttendanceRecord.attendance_date <= term.ends_on,
            )
        )
    )
    if not rows:
        return None

    priority = {
        AttendanceStatus.absent: 0,
        AttendanceStatus.late: 1,
        AttendanceStatus.excused: 2,
        AttendanceStatus.present: 3,
    }
    by_date: dict[dt.date, list[AttendanceStatus]] = {}
    for on_date, status in rows:
        by_date.setdefault(on_date, []).append(status)

    present_days = sum(
        1
        for statuses in by_date.values()
        if min(statuses, key=lambda s: priority[s])
        in (AttendanceStatus.present, AttendanceStatus.late)
    )
    total_days = len(by_date)
    pct = round((present_days / total_days) * 100, 1) if total_days else 0.0
    return ReportCardAttendanceOut(
        present_days=present_days,
        total_days=total_days,
        percentage=pct,
    )


async def get_preview(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_id: UUID,
    term_id: UUID | None = None,
) -> ReportCardPreviewOut:
    term = await _resolve_term(session, tenant_id, term_id)
    year = await session.get(AcademicYear, term.academic_year_id)
    if year is None:
        raise NotFoundError("Academic year not found.")

    school = await session.scalar(select(School).where(School.tenant_id == tenant_id))
    if school is None:
        raise NotFoundError("School profile not found.")

    student = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.id == student_id,
            Student.deleted_at.is_(None),
        )
    )
    if student is None:
        raise NotFoundError("Student not found.")

    registered = await session.scalar(
        select(StudentTermRegistration).where(
            StudentTermRegistration.tenant_id == tenant_id,
            StudentTermRegistration.student_id == student_id,
            StudentTermRegistration.term_id == term.id,
            StudentTermRegistration.status == "complete",
        )
    )
    if registered is None:
        raise ValidationError("Student is not fully registered for this term.")

    _, class_label, stream_name = await _student_placement(session, tenant_id, student)
    school_class: SchoolClass | None = None
    if student.class_id:
        school_class = await session.scalar(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.id == student.class_id,
            )
        )
    if school_class is None:
        raise ValidationError("Assign the student to a class before generating a report card.")

    subjects = await _subjects_for_level(session, tenant_id, school_class.level)
    mode = assessment_mode(school_class.level)

    # Dynamic assessment-set columns for this term (e.g. INTER ASSESS, MID EXAM).
    set_rows = list(
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
    included_set_ids = set(
        await session.scalars(
            select(CaSetInclusion.set_id).where(
                CaSetInclusion.tenant_id == tenant_id,
                CaSetInclusion.term_id == term.id,
            )
        )
    )
    assessment_sets = [
        ReportCardAssessmentSet(
            set_id=row.id,
            name=row.name,
            max_mark=row.max_mark,
            sort_order=row.sort_order,
            included_in_ca=row.id in included_set_ids,
        )
        for row in set_rows
    ]
    set_max: dict[UUID, int] = {row.id: row.max_mark for row in set_rows}

    # All raw marks this student has for the term, keyed by (set, subject).
    raw_marks = list(
        await session.execute(
            select(
                StudentAssessmentMark.set_id,
                StudentAssessmentMark.subject_id,
                StudentAssessmentMark.score,
            ).where(
                StudentAssessmentMark.tenant_id == tenant_id,
                StudentAssessmentMark.term_id == term.id,
                StudentAssessmentMark.student_id == student.id,
            )
        )
    )
    marks_by_subject: dict[UUID, dict[UUID, float]] = {}
    for set_id, subject_id, score in raw_marks:
        if score is None:
            continue
        marks_by_subject.setdefault(subject_id, {})[set_id] = float(score)

    primary_scale = await _primary_scale_for_cycle(
        session, tenant_id, LEVEL_CYCLE[school_class.level], subjects
    )

    subject_lines: list[ReportCardSubjectLine] = []
    marks_available = False
    for subject in subjects:
        ca = await assessment_service.compute_subject_ca(
            session,
            tenant_id,
            student_id=student.id,
            subject_id=subject.id,
            term_id=term.id,
            class_level=school_class.level,
        )
        entered = ca.status == "computed"
        if entered:
            marks_available = True

        subject_comment: str | None = None
        if entered and ca.ca_score is not None and primary_scale is not None:
            band = await _grade_range_for_mark(
                session, tenant_id, primary_scale.id, int(round(ca.ca_score))
            )
            if band is not None:
                subject_comment = band.comment

        subject_marks = marks_by_subject.get(subject.id, {})
        set_scores: list[ReportCardSetScore] = []
        for srow in set_rows:
            raw = subject_marks.get(srow.id)
            max_mark = set_max.get(srow.id, 100) or 100
            pct = round((raw / max_mark) * 100, 1) if raw is not None else None
            set_scores.append(
                ReportCardSetScore(
                    set_id=srow.id,
                    score=raw,
                    max_mark=max_mark,
                    percentage=pct,
                )
            )

        subject_lines.append(
            ReportCardSubjectLine(
                subject_id=subject.id,
                subject_code=subject.code,
                subject_name=subject.name,
                status="entered" if entered else "pending",
                is_core=subject.is_core,
                competence=ca.competence_level,
                ca_score=ca.ca_score,
                total_score=ca.ca_score,
                grade=ca.grade_label,
                aggregate_points=ca.aggregate_points,
                comment=subject_comment,
                set_scores=set_scores,
            )
        )

    grading_key = await _grading_key(session, tenant_id, primary_scale)

    # Totals: sum of subject CA scores and aggregate points (core subjects).
    total_marks: float | None = None
    total_aggregate: int | None = None
    if marks_available:
        scored = [
            line.ca_score for line in subject_lines if line.ca_score is not None
        ]
        if scored:
            total_marks = round(sum(scored), 1)
        agg_points = [
            line.aggregate_points
            for line in subject_lines
            if line.is_core and line.aggregate_points is not None
        ]
        if agg_points:
            total_aggregate = sum(agg_points)

    average_score, aggregate, division_label = await assessment_service.student_term_summary(
        session, tenant_id, student.id, term.id
    )
    attendance = await _attendance_summary(session, tenant_id, student.id, term)
    class_comment, head_comment, grade_label, comments_status = await _resolve_report_comments(
        session,
        tenant_id,
        student_id=student.id,
        term=term,
        school_class=school_class,
        subjects=subjects,
        assessment_mode=mode,
        marks_available=marks_available,
    )

    return ReportCardPreviewOut(
        layout=ReportCardLayoutOut(**merge_report_card_layout(school.report_card_layout)),
        school=ReportCardSchoolBranding(
            name=school.name,
            motto=school.motto,
            badge_url=school_badge_service.resolve_badge_url(tenant_id, school.badge_url),
            head_teacher_name=school.head_teacher_name,
            address_line=school.address_line,
            phone=school.phone,
            email=school.email,
        ),
        student=ReportCardStudentOut(
            student_id=student.id,
            student_number=student.student_number,
            first_name=student.first_name,
            last_name=student.last_name,
            middle_name=student.middle_name,
            class_label=class_label,
            stream_name=stream_name,
        ),
        term=ReportCardTermOut(
            term_id=term.id,
            label=term.label,
            term_number=term.term_number,
            academic_year_label=year.label,
        ),
        assessment_mode=mode,
        level_section=level_section(school_class.level),
        marks_available=marks_available,
        assessment_sets=assessment_sets,
        subject_lines=subject_lines,
        grading_key=grading_key,
        footer=await _report_footer(session, tenant_id, school=school, term=term),
        average_score=average_score,
        aggregate=aggregate,
        total_marks=total_marks,
        total_aggregate=total_aggregate,
        division_label=division_label,
        attendance=attendance,
        class_teacher_comment=class_comment,
        head_teacher_comment=head_comment,
        comment_grade_label=grade_label,
        comments_status=comments_status,
        generated_at=dt.datetime.now(dt.UTC),
    )


async def list_students_for_class(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    class_id: UUID,
    stream_id: UUID | None = None,
    term_id: UUID | None = None,
) -> tuple[list[ReportCardStudentOut], Term]:
    term = await _resolve_term(session, tenant_id, term_id)
    stmt = registered_students_stmt(
        tenant_id, term.id, class_id=class_id, stream_id=stream_id
    )
    students = list(await session.scalars(stmt))
    items: list[ReportCardStudentOut] = []
    for student in students:
        _, class_label, stream_name = await _student_placement(
            session, tenant_id, student
        )
        items.append(
            ReportCardStudentOut(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                last_name=student.last_name,
                middle_name=student.middle_name,
                class_label=class_label,
                stream_name=stream_name,
            )
        )
    return items, term

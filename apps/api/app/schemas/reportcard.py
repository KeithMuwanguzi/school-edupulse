"""Report card preview schemas — Phase 2 §2.4 (primary)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field


class ReportCardSchoolBranding(BaseModel):
    name: str
    motto: str | None = None
    badge_url: str | None = None
    head_teacher_name: str | None = None
    address_line: str | None = None
    phone: str | None = None
    email: str | None = None


class ReportCardStudentOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    class_label: str | None = None
    stream_name: str | None = None


class ReportCardTermOut(BaseModel):
    term_id: UUID
    label: str
    term_number: int
    academic_year_label: str


class ReportCardSetScore(BaseModel):
    """A student's mark for one assessment set within a subject row."""

    set_id: UUID
    score: float | None = None
    max_mark: int
    percentage: float | None = None
    grade: str | None = None


class ReportCardSubjectLine(BaseModel):
    subject_id: UUID
    subject_code: str
    subject_name: str
    status: str = Field(description="pending | entered")
    is_core: bool = False
    competence: str | None = None
    ca_score: float | None = None
    exam_score: float | None = None
    total_score: float | None = None
    grade: str | None = None
    aggregate_points: int | None = None
    remark: str | None = None
    comment: str | None = None
    set_scores: list[ReportCardSetScore] = Field(default_factory=list)


class ReportCardAssessmentSet(BaseModel):
    """A column header for the dynamic marks matrix."""

    set_id: UUID
    name: str
    max_mark: int
    sort_order: int
    included_in_ca: bool = False


class ReportCardGradeKey(BaseModel):
    label: str
    min_mark: int
    max_mark: int
    aggregate_points: int


class ReportCardFooterOut(BaseModel):
    next_term_label: str | None = None
    next_term_starts_on: dt.date | None = None
    next_term_note: str | None = None
    requirements_text: str | None = None
    term_fees_summary: str | None = None


class ReportCardAttendanceOut(BaseModel):
    present_days: int
    total_days: int
    percentage: float


class ReportCardPreviewOut(BaseModel):
    school: ReportCardSchoolBranding
    student: ReportCardStudentOut
    term: ReportCardTermOut
    assessment_mode: str = Field(description="competency | subject_ca | ple")
    level_section: str = Field(
        default="Primary",
        description="Lower Primary | Upper Primary | etc. for header display",
    )
    marks_available: bool = False
    assessment_sets: list[ReportCardAssessmentSet] = Field(default_factory=list)
    subject_lines: list[ReportCardSubjectLine]
    grading_key: list[ReportCardGradeKey] = Field(default_factory=list)
    footer: ReportCardFooterOut | None = None
    average_score: float | None = None
    aggregate: int | None = None
    total_marks: float | None = None
    total_aggregate: int | None = None
    division_label: str | None = None
    attendance: ReportCardAttendanceOut | None = None
    class_teacher_comment: str | None = None
    head_teacher_comment: str | None = None
    comment_grade_label: str | None = Field(
        default=None,
        description="Matched grading band label when comments were resolved",
    )
    comments_status: str = Field(
        description="pending_marks | resolved | no_scale | no_band"
    )
    generated_at: dt.datetime


class ReportCardClassOption(BaseModel):
    class_id: UUID
    class_label: str
    level: str
    registered_count: int

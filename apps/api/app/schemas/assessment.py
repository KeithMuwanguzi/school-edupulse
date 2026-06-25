"""Assessment module schemas — Phase 2 §9."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

ENTRY_STATUSES = {"draft", "open", "closed"}
CA_METHODS = {"average", "weighted_average"}
COMPETENCE_LEVELS = {"emerging", "developing", "proficient", "excellent"}


def _norm_status(v: str) -> str:
    v = v.strip().lower()
    if v not in ENTRY_STATUSES:
        raise ValueError(f"entry_status must be one of: {', '.join(sorted(ENTRY_STATUSES))}")
    return v


def _norm_ca_method(v: str) -> str:
    v = v.strip().lower()
    if v not in CA_METHODS:
        raise ValueError(f"method must be one of: {', '.join(sorted(CA_METHODS))}")
    return v


class AssessmentSetOut(BaseModel):
    id: UUID
    term_id: UUID
    name: str
    description: str | None = None
    max_mark: int
    sort_order: int
    entry_status: str
    marks_entered: int = 0


class AssessmentSetCreate(BaseModel):
    term_id: UUID
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    max_mark: int = Field(default=100, ge=1, le=1000)
    sort_order: int = 0


class AssessmentSetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    max_mark: int | None = Field(default=None, ge=1, le=1000)
    sort_order: int | None = None
    entry_status: str | None = None

    @field_validator("entry_status")
    @classmethod
    def _entry_status(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _norm_status(v)


class CaSetInclusionIn(BaseModel):
    set_id: UUID
    weight: float = Field(default=1.0, gt=0, le=100)
    sort_order: int = 0


class CaSetInclusionOut(CaSetInclusionIn):
    set_name: str
    entry_status: str


class TermCaConfigOut(BaseModel):
    term_id: UUID
    method: str
    notes: str | None = None
    inclusions: list[CaSetInclusionOut] = []


class TermCaConfigUpdate(BaseModel):
    method: str = "average"
    notes: str | None = None
    inclusions: list[CaSetInclusionIn] = Field(default_factory=list)

    @field_validator("method")
    @classmethod
    def _method(cls, v: str) -> str:
        return _norm_ca_method(v)


class AssessmentSummaryOut(BaseModel):
    term_id: UUID
    term_label: str
    total_sets: int
    open_sets: int
    closed_sets: int
    total_marks: int
    ca_configured: bool


class MarkEntryStudentRow(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    score: float | None = None
    competence_level: str | None = None
    remark: str | None = None


class MarkEntryRosterOut(BaseModel):
    set_id: UUID
    set_name: str
    max_mark: int
    entry_status: str
    term_id: UUID
    class_id: UUID
    class_label: str
    class_level: str
    subject_id: UUID
    subject_name: str
    scoring_mode: str = Field(description="numeric | competency")
    can_edit: bool
    students: list[MarkEntryStudentRow]


class MarkEntryItem(BaseModel):
    student_id: UUID
    score: float | None = None
    competence_level: str | None = None
    remark: str | None = None

    @field_validator("competence_level")
    @classmethod
    def _competence(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if not v:
            return None
        if v not in COMPETENCE_LEVELS:
            raise ValueError(
                f"competence_level must be one of: {', '.join(sorted(COMPETENCE_LEVELS))}"
            )
        return v


class MarkEntrySaveRequest(BaseModel):
    set_id: UUID
    class_id: UUID
    subject_id: UUID
    stream_id: UUID | None = None
    marks: list[MarkEntryItem] = Field(min_length=1, max_length=200)


class MarkEntrySaveResponse(BaseModel):
    saved: int
    set_id: UUID
    subject_id: UUID


class SubjectCaScoreOut(BaseModel):
    subject_id: UUID
    subject_code: str
    subject_name: str
    is_core: bool = False
    ca_score: float | None = None
    competence_level: str | None = None
    grade_label: str | None = None
    aggregate_points: int | None = None
    sets_used: int = 0
    status: str = Field(description="pending | computed")


class StudentCaSummaryOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    subjects: list[SubjectCaScoreOut]
    average_score: float | None = None
    aggregate: int | None = None
    division_label: str | None = None
    subjects_scored: int = 0


class ComputedCaOut(BaseModel):
    term_id: UUID
    class_id: UUID
    method: str
    ca_configured: bool = False
    using_all_recorded_sets: bool = False
    registered_count: int = 0
    excluded_unregistered: int = 0
    students: list[StudentCaSummaryOut]


class MarksGridSubjectCol(BaseModel):
    subject_id: UUID
    subject_code: str
    subject_name: str


class MarksGridCell(BaseModel):
    subject_id: UUID
    score: float | None = None
    competence_level: str | None = None
    display: str = "—"


class MarksGridStudentRow(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    cells: list[MarksGridCell]


class MarksGridOut(BaseModel):
    set_id: UUID
    set_name: str
    max_mark: int
    class_id: UUID
    class_level: str
    scoring_mode: str
    subjects: list[MarksGridSubjectCol]
    students: list[MarksGridStudentRow]


# --- Marks import (teacher Excel/CSV upload) -------------------------------


class MarksImportRow(BaseModel):
    """One spreadsheet row: a pupil identifier + their score for the subject."""

    student_number: str | None = Field(default=None, max_length=40)
    first_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    score: float | None = None
    competence_level: str | None = Field(default=None, max_length=40)
    remark: str | None = Field(default=None, max_length=255)


class MarksImportRequest(BaseModel):
    set_id: UUID
    class_id: UUID
    subject_id: UUID
    stream_id: UUID | None = None
    rows: list[MarksImportRow] = Field(min_length=1, max_length=1000)
    dry_run: bool = False


class MarksImportRowResult(BaseModel):
    line: int
    identifier: str
    matched_student_id: UUID | None = None
    status: str = Field(description="valid | imported | skipped | failed")
    message: str | None = None
    score: float | None = None


class MarksImportResponse(BaseModel):
    set_id: UUID
    subject_id: UUID
    imported: int = 0
    valid: int = 0
    skipped: int = 0
    failed: int = 0
    results: list[MarksImportRowResult]


# --- Student performance (per term) ----------------------------------------


class PerformanceSetMark(BaseModel):
    set_id: UUID
    set_name: str
    max_mark: int
    score: float | None = None
    percentage: float | None = None


class PerformanceSubject(BaseModel):
    subject_id: UUID
    subject_code: str
    subject_name: str
    is_core: bool = False
    ca_score: float | None = None
    grade_label: str | None = None
    aggregate_points: int | None = None
    status: str = "pending"
    set_marks: list[PerformanceSetMark] = []


class PerformanceSetColumn(BaseModel):
    set_id: UUID
    set_name: str
    max_mark: int


class StudentPerformanceOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    class_label: str | None = None
    class_level: str
    term_id: UUID
    term_label: str
    set_columns: list[PerformanceSetColumn] = []
    subjects: list[PerformanceSubject] = []
    average_score: float | None = None
    aggregate: int | None = None
    division_label: str | None = None
    marks_available: bool = False

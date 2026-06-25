"""P7 PLE candidacy schemas — Phase 2 §11."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field


class PleCandidateStudentOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    class_label: str | None = None
    stream_name: str | None = None


class PleReadinessOut(BaseModel):
    """Current-term assessment snapshot for a P7 candidate."""

    term_id: UUID | None = None
    term_label: str | None = None
    average_score: float | None = None
    aggregate: int | None = None
    division_label: str | None = None
    marks_available: bool = False


class PleCandidateOut(BaseModel):
    id: UUID
    student_id: UUID
    academic_year_id: UUID
    academic_year_label: str
    status: str
    candidate_number: str | None = None
    registered_on: dt.date | None = None
    withdrawn_on: dt.date | None = None
    withdrawal_reason: str | None = None
    notes: str | None = None
    student: PleCandidateStudentOut
    readiness: PleReadinessOut


class PleEligibleStudentOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    class_label: str | None = None
    stream_name: str | None = None
    readiness: PleReadinessOut


class PleCandidateNominate(BaseModel):
    student_ids: list[UUID] = Field(min_length=1, max_length=200)


class PleCandidateUpdate(BaseModel):
    status: str | None = Field(
        default=None,
        description="nominated | registered | withdrawn | completed",
    )
    candidate_number: str | None = None
    registered_on: dt.date | None = None
    withdrawn_on: dt.date | None = None
    withdrawal_reason: str | None = None
    notes: str | None = None


class PleCandidacySummaryOut(BaseModel):
    academic_year_id: UUID
    academic_year_label: str
    term_label: str | None = None
    total_p7_registered: int
    nominated: int
    registered: int
    withdrawn: int
    completed: int
    not_nominated: int

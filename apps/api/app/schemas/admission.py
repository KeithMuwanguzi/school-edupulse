"""Admission application schemas — Phase 2 §14."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field

ADMISSION_STATUSES = ("application", "interview", "accepted", "enrolled", "withdrawn")

WITHDRAWAL_REASONS = ("rejected", "withdrew", "no_show", "other")

STATUS_TRANSITIONS: dict[str, set[str]] = {
    "application": {"interview", "withdrawn"},
    "interview": {"accepted", "withdrawn", "application"},
    "accepted": {"enrolled", "withdrawn", "interview"},
    "enrolled": set(),
    "withdrawn": {"application"},
}


class AdmissionApplicationCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    middle_name: str | None = Field(default=None, max_length=120)
    gender: str | None = Field(default=None, max_length=10)
    date_of_birth: dt.date | None = None
    applied_class_level: str | None = Field(default=None, max_length=10)
    applied_class_id: UUID | None = None
    applied_stream_id: UUID | None = None
    guardian_name: str | None = Field(default=None, max_length=160)
    guardian_relationship: str | None = Field(default=None, max_length=30)
    guardian_phone: str | None = Field(default=None, max_length=30)
    guardian_email: str | None = Field(default=None, max_length=255)
    previous_school: str | None = Field(default=None, max_length=160)
    notes: str | None = None
    applied_at: dt.date | None = None


class AdmissionBatchRowCreate(BaseModel):
    """Looser row model — per-row validation happens in the service."""

    first_name: str = Field(default="", max_length=120)
    last_name: str = Field(default="", max_length=120)
    middle_name: str | None = Field(default=None, max_length=120)
    gender: str | None = Field(default=None, max_length=10)
    date_of_birth: dt.date | None = None
    applied_class_level: str | None = Field(default=None, max_length=10)
    applied_class_id: UUID | None = None
    applied_stream_id: UUID | None = None
    guardian_name: str | None = Field(default=None, max_length=160)
    guardian_relationship: str | None = Field(default=None, max_length=30)
    guardian_phone: str | None = Field(default=None, max_length=30)
    guardian_email: str | None = Field(default=None, max_length=255)
    previous_school: str | None = Field(default=None, max_length=160)
    notes: str | None = None
    applied_at: dt.date | None = None


class AdmissionApplicationUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    middle_name: str | None = Field(default=None, max_length=120)
    gender: str | None = Field(default=None, max_length=10)
    date_of_birth: dt.date | None = None
    applied_class_level: str | None = Field(default=None, max_length=10)
    applied_class_id: UUID | None = None
    applied_stream_id: UUID | None = None
    guardian_name: str | None = Field(default=None, max_length=160)
    guardian_relationship: str | None = Field(default=None, max_length=30)
    guardian_phone: str | None = Field(default=None, max_length=30)
    guardian_email: str | None = Field(default=None, max_length=255)
    previous_school: str | None = Field(default=None, max_length=160)
    notes: str | None = None
    interview_date: dt.date | None = None
    interview_score: int | None = Field(default=None, ge=0, le=100)
    status: str | None = Field(default=None, max_length=20)
    withdrawal_reason: str | None = Field(default=None, max_length=20)
    withdrawal_note: str | None = None


class AdmissionApplicationOut(BaseModel):
    id: UUID
    reference_number: str
    status: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    gender: str | None = None
    date_of_birth: dt.date | None = None
    applied_class_level: str | None = None
    applied_class_id: UUID | None = None
    applied_stream_id: UUID | None = None
    applied_class_label: str | None = None
    applied_stream_name: str | None = None
    guardian_name: str | None = None
    guardian_relationship: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    previous_school: str | None = None
    notes: str | None = None
    interview_date: dt.date | None = None
    interview_score: int | None = None
    applied_at: dt.date
    student_id: UUID | None = None
    enrolled_at: dt.date | None = None
    withdrawal_reason: str | None = None
    withdrawal_note: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}


class AdmissionEnrollLink(BaseModel):
    student_id: UUID


class AdmissionBatchCreate(BaseModel):
    rows: list[AdmissionBatchRowCreate] = Field(min_length=1, max_length=200)


class AdmissionBatchRowResult(BaseModel):
    line: int
    identifier: str
    status: str
    message: str | None = None
    application_id: UUID | None = None
    reference_number: str | None = None


class AdmissionBatchResponse(BaseModel):
    created: int
    failed: int
    results: list[AdmissionBatchRowResult]

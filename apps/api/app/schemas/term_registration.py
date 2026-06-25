"""Term registration schemas — config + workflow."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

FIELD_TYPES = {"checkbox", "text", "textarea", "date", "number", "select"}
RESPONSE_STATUSES = {"pending", "satisfied", "waived"}
REGISTRATION_STATUSES = {"not_started", "in_progress", "complete"}


def _slugify(value: str) -> str:
    import re

    s = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return s[:40] or "item"


# --- Config -----------------------------------------------------------------


class RequirementOut(BaseModel):
    id: UUID
    section_id: UUID
    slug: str
    label: str
    description: str | None = None
    field_type: str
    is_required: bool
    options: list[str] | None = None
    sort_order: int
    is_active: bool


class SectionOut(BaseModel):
    id: UUID
    slug: str
    label: str
    description: str | None = None
    icon: str | None = None
    sort_order: int
    is_active: bool
    requirements: list[RequirementOut] = []


class RegistrationConfigOut(BaseModel):
    sections: list[SectionOut]


class SectionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=40)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=40)
    sort_order: int | None = None

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _slugify(v)


class SectionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=40)
    sort_order: int | None = None
    is_active: bool | None = None


class RequirementCreate(BaseModel):
    label: str = Field(min_length=1, max_length=160)
    slug: str | None = Field(default=None, max_length=40)
    description: str | None = None
    field_type: str = "checkbox"
    is_required: bool = True
    options: list[str] | None = None
    sort_order: int | None = None

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _slugify(v)

    @field_validator("field_type")
    @classmethod
    def _field_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in FIELD_TYPES:
            raise ValueError(f"field_type must be one of: {', '.join(sorted(FIELD_TYPES))}")
        return v


class RequirementUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    field_type: str | None = None
    is_required: bool | None = None
    options: list[str] | None = None
    sort_order: int | None = None
    is_active: bool | None = None

    @field_validator("field_type")
    @classmethod
    def _field_type(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if v not in FIELD_TYPES:
            raise ValueError(f"field_type must be one of: {', '.join(sorted(FIELD_TYPES))}")
        return v


class SectionReorder(BaseModel):
    section_ids: list[UUID] = Field(min_length=1)


# --- Workflow ---------------------------------------------------------------


class RegistrationStart(BaseModel):
    student_id: UUID
    term_id: UUID | None = None


class ResponseInput(BaseModel):
    requirement_id: UUID
    value: str | bool | int | float | None = None
    status: str = "satisfied"
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in RESPONSE_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(RESPONSE_STATUSES))}")
        return v


class ResponsesUpsert(BaseModel):
    responses: list[ResponseInput] = Field(min_length=1)


class ResponseOut(BaseModel):
    id: UUID
    requirement_id: UUID
    value: str | bool | int | float | None = None
    status: str
    notes: str | None = None
    recorded_by_name: str | None = None
    recorded_at: dt.datetime | None = None


class SectionProgressOut(BaseModel):
    section_id: UUID
    slug: str
    label: str
    icon: str | None = None
    required_total: int
    required_done: int
    optional_total: int
    optional_done: int
    is_complete: bool
    requirements: list[RequirementOut]
    responses: list[ResponseOut]


class RegistrationSummaryOut(BaseModel):
    term_id: UUID
    term_label: str
    total_students: int
    not_started: int
    in_progress: int
    complete: int


class QueueItemOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    class_level: str | None = None
    class_label: str | None = None
    stream_name: str | None = None
    registration_id: UUID | None = None
    status: str
    required_total: int = 0
    required_done: int = 0
    sections_complete: int = 0
    sections_total: int = 0


class RegistrationDetailOut(BaseModel):
    id: UUID
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    term_id: UUID
    term_label: str
    status: str
    class_level: str | None = None
    class_label: str | None = None
    stream_name: str | None = None
    required_total: int
    required_done: int
    sections_complete: int
    sections_total: int
    completed_at: dt.datetime | None = None
    sections: list[SectionProgressOut]


# --- Term roster (registered students only) ---------------------------------


class RegisteredStreamSummaryOut(BaseModel):
    stream_id: UUID
    name: str
    count: int


class RegisteredClassSummaryOut(BaseModel):
    class_id: UUID
    level: str
    label: str
    count: int
    streams: list[RegisteredStreamSummaryOut]


class RegisteredRosterSummaryOut(BaseModel):
    term_id: UUID
    term_label: str
    total_registered: int
    total_enrolled: int
    unassigned: int
    classes: list[RegisteredClassSummaryOut]


class RegisteredStudentOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    class_level: str | None = None
    class_label: str | None = None
    stream_name: str | None = None
    registration_id: UUID | None = None
    registered_at: dt.datetime | None = None

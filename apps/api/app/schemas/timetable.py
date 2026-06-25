"""Timetable schemas — weekly lesson slots and the teacher's day view."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class TimetableSlotBase(BaseModel):
    day_of_week: int = Field(ge=1, le=7, description="ISO weekday: 1=Mon … 7=Sun")
    starts_at: dt.time
    ends_at: dt.time
    class_id: UUID
    stream_id: UUID | None = None
    subject_id: UUID
    teacher_user_id: UUID
    period_label: str | None = Field(default=None, max_length=40)
    room: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def _check_times(self) -> "TimetableSlotBase":
        if self.ends_at <= self.starts_at:
            raise ValueError("Lesson end time must be after the start time.")
        return self


class TimetableSlotCreate(TimetableSlotBase):
    pass


class TimetableSlotUpdate(TimetableSlotBase):
    pass


class TimetableSlotOut(BaseModel):
    id: UUID
    academic_year_id: UUID
    day_of_week: int
    starts_at: dt.time
    ends_at: dt.time
    class_id: UUID
    class_level: str
    class_label: str
    stream_id: UUID | None
    stream_name: str | None
    subject_id: UUID
    subject_code: str
    subject_name: str
    teacher_user_id: UUID
    teacher_name: str
    period_label: str | None
    room: str | None


class TeacherLessonOut(TimetableSlotOut):
    """A teacher's scheduled lesson on a specific date, with marking state."""

    is_today: bool
    has_ended: bool
    can_record: bool
    recorded: bool
    enrolled: int


class TeacherDayOut(BaseModel):
    date: dt.date
    day_of_week: int
    academic_year_label: str
    term_label: str | None
    lessons: list[TeacherLessonOut]


class TimetableImportRow(BaseModel):
    day: str
    starts_at: str
    ends_at: str
    class_level: str
    stream_name: str | None = None
    subject_code: str
    teacher: str
    room: str | None = None


class TimetableImportRequest(BaseModel):
    # A whole term's weekly schedule across every class/stream can be large.
    rows: list[TimetableImportRow] = Field(min_length=1, max_length=2000)
    dry_run: bool = False


class TimetableImportRowResult(BaseModel):
    line: int
    identifier: str
    status: str  # valid | created | failed
    message: str | None = None


class TimetableImportResponse(BaseModel):
    created: int
    failed: int
    valid: int
    results: list[TimetableImportRowResult]

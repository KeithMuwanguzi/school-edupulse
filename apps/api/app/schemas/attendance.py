"""Attendance schemas — Phase 2 §7."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

ATTENDANCE_STATUSES = frozenset({"present", "absent", "late", "excused"})


class ClassAttendanceCount(BaseModel):
    class_id: UUID
    level: str
    label: str
    enrolled: int
    marked: int
    present: int
    absent: int
    late: int
    excused: int


class AttendanceDailySummary(BaseModel):
    date: dt.date
    academic_year_label: str
    term_label: str | None
    total_enrolled: int
    total_marked: int
    present: int
    absent: int
    late: int
    excused: int
    chronic_absentees: int
    classes: list[ClassAttendanceCount]


class AttendanceRollRow(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    status: str
    remarks: str | None
    saved: bool
    term_rate: float | None


class AttendanceRollOut(BaseModel):
    date: dt.date
    class_id: UUID
    class_level: str
    stream_id: UUID | None
    stream_name: str | None
    timetable_slot_id: UUID | None = None
    rows: list[AttendanceRollRow]
    present: int
    absent: int
    late: int
    excused: int


class AttendanceMarkRow(BaseModel):
    student_id: UUID
    status: str = "present"
    remarks: str | None = Field(default=None, max_length=255)

    @field_validator("status")
    @classmethod
    def _validate_status(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ATTENDANCE_STATUSES:
            raise ValueError("status must be present, absent, late, or excused")
        return v


class AttendanceMarkRequest(BaseModel):
    class_id: UUID
    stream_id: UUID | None = None
    timetable_slot_id: UUID | None = None
    date: dt.date | None = None
    records: list[AttendanceMarkRow] = Field(min_length=1, max_length=200)


class AttendanceMarkResponse(BaseModel):
    date: dt.date
    saved: int
    present: int
    absent: int
    late: int
    excused: int


class ClassAttendanceLessonOut(BaseModel):
    slot_id: UUID
    starts_at: dt.time
    ends_at: dt.time
    subject_code: str
    subject_name: str
    teacher_name: str
    period_label: str | None = None
    room: str | None = None
    enrolled: int
    recorded: bool
    present: int
    absent: int
    late: int
    excused: int


class ClassAttendanceDayOut(BaseModel):
    date: dt.date
    day_of_week: int
    class_id: UUID
    class_label: str
    class_level: str
    stream_id: UUID | None = None
    stream_name: str | None = None
    academic_year_label: str
    term_label: str | None = None
    lessons: list[ClassAttendanceLessonOut]

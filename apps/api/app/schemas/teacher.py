"""Teacher & assignment schemas — Phase 2 §6."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class TeacherStaffOut(BaseModel):
    id: UUID
    login_id: str
    username: str
    name: str
    role: str
    status: str
    assignment_count: int


class TeacherAssignmentOut(BaseModel):
    id: UUID
    teacher_user_id: UUID
    teacher_name: str
    academic_year_id: UUID
    academic_year_label: str
    term_id: UUID | None
    term_label: str | None
    class_id: UUID
    class_level: str
    stream_id: UUID | None
    stream_name: str | None
    subject_id: UUID
    subject_code: str
    subject_name: str
    is_class_teacher: bool


class TeacherAssignmentCreate(BaseModel):
    teacher_user_id: UUID
    class_id: UUID
    subject_id: UUID
    stream_id: UUID | None = None
    term_id: UUID | None = None
    is_class_teacher: bool = False


class TeacherAssignmentUpdate(BaseModel):
    class_id: UUID | None = None
    subject_id: UUID | None = None
    stream_id: UUID | None = None
    term_id: UUID | None = None
    is_class_teacher: bool | None = None
    clear_stream: bool = False
    clear_term: bool = False

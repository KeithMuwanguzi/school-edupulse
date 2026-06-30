"""Parent portal — guardian-facing views scoped to one pupil per login."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class ParentGuardianContactOut(BaseModel):
    relationship: str
    full_name: str
    is_primary: bool


class ParentChildOut(BaseModel):
    id: UUID
    student_number: str
    first_name: str
    last_name: str
    preferred_name: str | None = None
    class_label: str | None = None
    stream_name: str | None = None
    photo_url: str | None = None
    status: str


class ParentFeeSummaryOut(BaseModel):
    term_label: str
    balance_ugx: int
    status: str
    is_overdue: bool


class ParentPortalOverviewOut(BaseModel):
    portal_username: str
    child: ParentChildOut
    guardians: list[ParentGuardianContactOut]
    attendance_rate: float | None = None
    fee: ParentFeeSummaryOut | None = None
    circular_count: int = 0

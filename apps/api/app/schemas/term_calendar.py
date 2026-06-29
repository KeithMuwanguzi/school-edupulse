"""Term calendar event schemas."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TermCalendarEventOut(BaseModel):
    id: UUID
    academic_year_id: UUID
    term_id: UUID
    term_number: int
    term_label: str
    event_type: str
    title: str
    starts_on: dt.date
    ends_on: dt.date
    description: str | None = None


class TermCalendarEventCreate(BaseModel):
    event_type: str = Field(
        pattern=(
            "^(short_holiday|visitation|class_meeting|sports_day|exam_period|"
            "opening_day|closing_day|other)$"
        )
    )
    title: str = Field(min_length=1, max_length=160)
    starts_on: dt.date
    ends_on: dt.date
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("ends_on")
    @classmethod
    def _end_after_start(cls, ends_on: dt.date, info) -> dt.date:
        starts = info.data.get("starts_on")
        if starts and ends_on < starts:
            raise ValueError("End date must be on or after start date.")
        return ends_on


class TermCalendarEventUpdate(BaseModel):
    event_type: str | None = Field(
        default=None,
        pattern=(
            "^(short_holiday|visitation|class_meeting|sports_day|exam_period|"
            "opening_day|closing_day|other)$"
        ),
    )
    title: str | None = Field(default=None, min_length=1, max_length=160)
    starts_on: dt.date | None = None
    ends_on: dt.date | None = None
    description: str | None = Field(default=None, max_length=2000)

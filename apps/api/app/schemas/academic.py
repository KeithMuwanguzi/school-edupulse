"""Academic calendar schemas — Phase 2 §1."""
from __future__ import annotations

import datetime as dt
import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.school import AcademicYearOut, TermOut


class AcademicYearWithTerms(AcademicYearOut):
    terms: list[TermOut] = Field(default_factory=list)


class AcademicYearCreate(BaseModel):
    label: str = Field(min_length=4, max_length=4)

    @field_validator("label")
    @classmethod
    def _year_label(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^\d{4}$", v):
            raise ValueError("label must be a four-digit year e.g. 2026")
        return v


class AcademicYearUpdate(BaseModel):
    starts_on: dt.date | None = None
    ends_on: dt.date | None = None
    status: str | None = Field(default=None, pattern="^(upcoming|active|archived)$")


class TermUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=20)
    starts_on: dt.date | None = None
    ends_on: dt.date | None = None
    status: str | None = Field(default=None, pattern="^(upcoming|active|closed)$")


class AcademicContextEnriched(BaseModel):
    academic_year: AcademicYearOut | None = None
    active_term: TermOut | None = None
    terms: list[TermOut] = Field(default_factory=list)

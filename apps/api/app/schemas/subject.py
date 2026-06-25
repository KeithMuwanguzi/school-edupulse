"""Subject catalogue schemas — Phase 2 §2."""
from __future__ import annotations

import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import NcdcCycle

CYCLE_ORDER = (NcdcCycle.cycle_1, NcdcCycle.cycle_2, NcdcCycle.cycle_3)


def sort_cycles(cycles: list[NcdcCycle]) -> list[NcdcCycle]:
    order = {c: i for i, c in enumerate(CYCLE_ORDER)}
    unique = list(dict.fromkeys(cycles))
    return sorted(unique, key=lambda c: order[c])


_CORE_CODE_PREFIXES = (
    "ENG",
    "MTC",
    "MATH",
    "SCI",
    "SST",
    "SOCIAL",
)


def default_is_core(code: str) -> bool:
    normalized = code.replace(" ", "").upper()
    return any(normalized.startswith(prefix) for prefix in _CORE_CODE_PREFIXES)


class SubjectOut(BaseModel):
    id: UUID
    code: str
    name: str
    ncdc_cycles: list[str]
    ncdc_cycle: str
    is_active: bool
    is_core: bool
    sort_order: int


class SubjectCreate(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    ncdc_cycles: list[NcdcCycle] | None = None
    ncdc_cycle: NcdcCycle | None = None
    is_core: bool | None = None
    sort_order: int = Field(default=0, ge=0, le=9999)

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^[A-Z0-9_-]+$", v):
            raise ValueError("code must be uppercase letters, digits, _ or -")
        return v

    @model_validator(mode="after")
    def _resolve_cycles(self) -> SubjectCreate:
        if self.ncdc_cycles:
            self.ncdc_cycles = sort_cycles(self.ncdc_cycles)
        elif self.ncdc_cycle is not None:
            self.ncdc_cycles = [self.ncdc_cycle]
        else:
            raise ValueError("Provide ncdc_cycles or ncdc_cycle")
        return self


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    ncdc_cycles: list[NcdcCycle] | None = None
    ncdc_cycle: NcdcCycle | None = None
    is_active: bool | None = None
    is_core: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=9999)

    @model_validator(mode="after")
    def _resolve_cycles(self) -> SubjectUpdate:
        if self.ncdc_cycles is not None:
            if len(self.ncdc_cycles) < 1:
                raise ValueError("ncdc_cycles must include at least one cycle")
            self.ncdc_cycles = sort_cycles(self.ncdc_cycles)
        elif self.ncdc_cycle is not None:
            self.ncdc_cycles = [self.ncdc_cycle]
        return self

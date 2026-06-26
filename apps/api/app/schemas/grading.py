"""Grading configuration — scales per NCDC section, subject assignments, divisions."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.enums import NcdcCycle

CYCLE_SECTIONS: list[tuple[NcdcCycle, str]] = [
    (NcdcCycle.ecd, "Baby–Top"),
    (NcdcCycle.cycle_1, "P1–P3"),
    (NcdcCycle.cycle_2, "P4"),
    (NcdcCycle.cycle_3, "P5–P7"),
]


class GradeRangeOut(BaseModel):
    id: UUID
    scale_id: UUID
    label: str
    aggregate_weight: int
    min_mark: int
    max_mark: int
    comment: str | None = None
    sort_order: int
    is_active: bool


class GradeRangeCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    aggregate_weight: int = Field(ge=1, le=9)
    min_mark: int = Field(ge=0, le=100)
    max_mark: int = Field(ge=0, le=100)
    comment: str | None = Field(default=None, max_length=200)
    sort_order: int | None = None

    @field_validator("max_mark")
    @classmethod
    def _mark_range(cls, v: int, info) -> int:
        min_mark = info.data.get("min_mark")
        if min_mark is not None and v < min_mark:
            raise ValueError("max_mark must be >= min_mark")
        return v


class GradeRangeUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=80)
    aggregate_weight: int | None = Field(default=None, ge=1, le=9)
    min_mark: int | None = Field(default=None, ge=0, le=100)
    max_mark: int | None = Field(default=None, ge=0, le=100)
    comment: str | None = Field(default=None, max_length=200)
    sort_order: int | None = None
    is_active: bool | None = None


class GradingScaleOut(BaseModel):
    id: UUID
    name: str
    ncdc_cycle: str
    description: str | None = None
    sort_order: int
    ranges: list[GradeRangeOut]
    subject_count: int


class GradingScaleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    ncdc_cycle: str
    description: str | None = None
    sort_order: int | None = None

    @field_validator("ncdc_cycle")
    @classmethod
    def _cycle(cls, v: str) -> str:
        v = v.strip()
        if v not in {c.value for c in NcdcCycle}:
            raise ValueError("ncdc_cycle must be cycle_1, cycle_2, or cycle_3")
        return v


class GradingScaleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    sort_order: int | None = None


class SubjectGradingOut(BaseModel):
    subject_id: UUID
    subject_code: str
    subject_name: str
    ncdc_cycles: list[str]
    grading_scale_id: UUID | None = None
    grading_scale_name: str | None = None
    in_section: bool = True


class SubjectGradingScaleUpdate(BaseModel):
    grading_scale_id: UUID | None = None
    ncdc_cycle: str

    @field_validator("ncdc_cycle")
    @classmethod
    def _cycle(cls, v: str) -> str:
        v = v.strip()
        if v not in {c.value for c in NcdcCycle}:
            raise ValueError("ncdc_cycle must be ecd, cycle_1, cycle_2, or cycle_3")
        return v


class CycleGradingSectionOut(BaseModel):
    cycle: str
    cycle_label: str
    scales: list[GradingScaleOut]
    subjects: list[SubjectGradingOut]
    extendable_subjects: list[SubjectGradingOut] = Field(default_factory=list)


class AggregateDivisionOut(BaseModel):
    id: UUID
    label: str
    min_aggregate: int
    max_aggregate: int
    class_teacher_comment: str | None = None
    head_teacher_comment: str | None = None
    sort_order: int
    is_active: bool


class AggregateDivisionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    min_aggregate: int = Field(ge=4, le=36)
    max_aggregate: int = Field(ge=4, le=36)
    class_teacher_comment: str | None = Field(default=None, max_length=2000)
    head_teacher_comment: str | None = Field(default=None, max_length=2000)
    sort_order: int | None = None

    @field_validator("max_aggregate")
    @classmethod
    def _aggregate_range(cls, v: int, info) -> int:
        min_agg = info.data.get("min_aggregate")
        if min_agg is not None and v < min_agg:
            raise ValueError("max_aggregate must be >= min_aggregate")
        return v


class AggregateDivisionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=80)
    min_aggregate: int | None = Field(default=None, ge=4, le=36)
    max_aggregate: int | None = Field(default=None, ge=4, le=36)
    class_teacher_comment: str | None = Field(default=None, max_length=2000)
    head_teacher_comment: str | None = Field(default=None, max_length=2000)
    sort_order: int | None = None
    is_active: bool | None = None


class GradingConfigOut(BaseModel):
    sections: list[CycleGradingSectionOut]
    aggregate_divisions: list[AggregateDivisionOut]

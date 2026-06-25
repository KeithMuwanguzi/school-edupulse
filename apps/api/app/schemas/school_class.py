"""Classes & streams schemas — Phase 2 §3."""
from __future__ import annotations

import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ClassLevel


class StreamOut(BaseModel):
    id: UUID
    name: str
    is_active: bool
    sort_order: int


class ClassOut(BaseModel):
    id: UUID
    level: str
    label: str
    is_active: bool
    sort_order: int
    streams: list[StreamOut] = Field(default_factory=list)


class ClassCreate(BaseModel):
    level: ClassLevel
    label: str | None = Field(default=None, max_length=120)
    sort_order: int | None = Field(default=None, ge=0, le=99)


class ClassUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=2, max_length=120)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=99)


class StreamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    sort_order: int = Field(default=0, ge=0, le=99)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[A-Za-z0-9][A-Za-z0-9 _-]*$", v):
            raise ValueError("Stream name must start with a letter or digit.")
        return v


class StreamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=20)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=99)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not re.match(r"^[A-Za-z0-9][A-Za-z0-9 _-]*$", v):
            raise ValueError("Stream name must start with a letter or digit.")
        return v

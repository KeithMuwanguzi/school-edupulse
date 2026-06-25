"""Boarding & Hostel add-on schemas — Phase 2 §19."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, field_validator

HOSTEL_GENDERS = frozenset({"boys", "girls", "mixed"})


def _norm_gender(v: str | None) -> str:
    if v is None:
        return "mixed"
    v = v.strip().lower()
    if v in {"male", "boy", "b", "m"}:
        v = "boys"
    if v in {"female", "girl", "g", "f"}:
        v = "girls"
    if v not in HOSTEL_GENDERS:
        raise ValueError("gender must be boys, girls, or mixed")
    return v


# --- Rooms -----------------------------------------------------------------


class HostelRoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    capacity: int = Field(default=0, ge=0, le=500)
    floor: str | None = Field(default=None, max_length=40)
    notes: str | None = None
    is_active: bool = True
    sort_order: int = 0


class HostelRoomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    capacity: int | None = Field(default=None, ge=0, le=500)
    floor: str | None = Field(default=None, max_length=40)
    notes: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class HostelRoomOut(BaseModel):
    id: UUID
    hostel_id: UUID
    name: str
    capacity: int
    floor: str | None
    notes: str | None
    is_active: bool
    sort_order: int
    occupied: int = 0
    available: int = 0


# --- Hostels ---------------------------------------------------------------


class HostelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=20)
    gender: str = "mixed"
    capacity: int | None = Field(default=None, ge=0, le=5000)
    warden_user_id: UUID | None = None
    location: str | None = Field(default=None, max_length=160)
    notes: str | None = None
    is_active: bool = True
    sort_order: int = 0

    @field_validator("gender")
    @classmethod
    def _gender(cls, v: str) -> str:
        return _norm_gender(v)


class HostelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=20)
    gender: str | None = None
    capacity: int | None = Field(default=None, ge=0, le=5000)
    warden_user_id: UUID | None = None
    clear_warden: bool = False
    location: str | None = Field(default=None, max_length=160)
    notes: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None

    @field_validator("gender")
    @classmethod
    def _gender(cls, v: str | None) -> str | None:
        return _norm_gender(v) if v is not None else None


class HostelOut(BaseModel):
    id: UUID
    name: str
    code: str | None
    gender: str
    capacity: int | None
    warden_user_id: UUID | None
    warden_name: str | None = None
    location: str | None
    notes: str | None
    is_active: bool
    sort_order: int
    room_count: int = 0
    # Effective capacity = explicit capacity, else sum of room capacities.
    effective_capacity: int | None = None
    occupied: int = 0
    available: int | None = None
    occupancy_pct: int = 0


class HostelResidentOut(BaseModel):
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    gender: str | None = None
    class_label: str | None = None
    stream_name: str | None = None
    hostel_room_id: UUID | None = None
    room_name: str | None = None


class HostelDetailOut(HostelOut):
    rooms: list[HostelRoomOut] = []
    residents: list[HostelResidentOut] = []
    unassigned_residents: int = 0


# --- Registration / allocation --------------------------------------------


class HostelRoomOptionOut(BaseModel):
    id: UUID
    name: str
    capacity: int
    occupied: int
    available: int
    is_full: bool


class HostelOptionOut(BaseModel):
    id: UUID
    name: str
    gender: str
    effective_capacity: int | None
    occupied: int
    available: int | None
    is_full: bool
    rooms: list[HostelRoomOptionOut] = []


class AllocateRequest(BaseModel):
    student_id: UUID
    hostel_id: UUID
    hostel_room_id: UUID | None = None


class CheckoutRequest(BaseModel):
    student_id: UUID

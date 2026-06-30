"""Student enrollment & profile schemas — Phase 2 §5."""
from __future__ import annotations

import datetime as dt
import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.school_levels import CLASS_LEVEL_VALUES

STUDENT_NUMBER_RE = re.compile(r"^\d{4,20}$")

GENDERS = {"male", "female"}
RESIDENCES = {"day", "boarder"}
STATUSES = {"enrolled", "transferred", "graduated", "withdrawn", "suspended"}
RELATIONSHIPS = {
    "father",
    "mother",
    "guardian",
    "grandparent",
    "sibling",
    "aunt",
    "uncle",
    "other",
}
DISCIPLINE_STATUS = {"open", "resolved", "escalated"}
SEVERITIES = {"minor", "moderate", "major"}


def _norm_choice(v: str | None, allowed: set[str], label: str) -> str | None:
    if v is None:
        return None
    v = v.strip().lower()
    if not v:
        return None
    if v == "m":
        v = "male"
    if v == "f":
        v = "female"
    if v not in allowed:
        raise ValueError(f"{label} must be one of: {', '.join(sorted(allowed))}")
    return v


_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y")
_SCI_NOTATION_RE = re.compile(r"^\d+(?:\.\d+)?[eE][+-]?\d+$")


def _parse_flexible_date(v: object, *, label: str) -> dt.date | None:
    if v is None:
        return None
    if isinstance(v, dt.date):
        return v
    if isinstance(v, dt.datetime):
        return v.date()
    text = str(v).strip()
    if not text:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return dt.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"{label} must be YYYY-MM-DD or DD/MM/YYYY (got '{text}')")


def _normalize_spreadsheet_phone(v: object) -> str | None:
    if v is None:
        return None
    text = str(v).strip()
    if not text:
        return None
    if _SCI_NOTATION_RE.match(text):
        try:
            as_int = int(float(text))
            return str(as_int)
        except ValueError:
            return text
    return text


# --- Guardians -------------------------------------------------------------


class GuardianInput(BaseModel):
    relationship: str = Field(max_length=30)
    full_name: str = Field(min_length=1, max_length=160)
    phone_primary: str | None = Field(default=None, max_length=30)
    phone_alt: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    occupation: str | None = Field(default=None, max_length=120)
    national_id: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)
    is_primary: bool = False
    is_emergency: bool = False
    can_pickup: bool = True
    portal_user_id: UUID | None = None

    @field_validator("relationship")
    @classmethod
    def _rel(cls, v: str) -> str:
        out = _norm_choice(v, RELATIONSHIPS, "relationship")
        return out or "other"


class GuardianUpdate(BaseModel):
    relationship: str | None = Field(default=None, max_length=30)
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    phone_primary: str | None = Field(default=None, max_length=30)
    phone_alt: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    occupation: str | None = Field(default=None, max_length=120)
    national_id: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)
    is_primary: bool | None = None
    is_emergency: bool | None = None
    can_pickup: bool | None = None
    portal_user_id: UUID | None = None
    clear_portal_user: bool = False

    @field_validator("relationship")
    @classmethod
    def _rel(cls, v: str | None) -> str | None:
        return _norm_choice(v, RELATIONSHIPS, "relationship")


class GuardianOut(BaseModel):
    id: UUID
    student_id: UUID
    relationship: str
    full_name: str
    phone_primary: str | None
    phone_alt: str | None
    email: str | None
    occupation: str | None
    national_id: str | None
    address: str | None
    is_primary: bool
    is_emergency: bool
    can_pickup: bool
    portal_user_id: UUID | None
    portal_username: str | None = None


# --- Health ----------------------------------------------------------------


class HealthInput(BaseModel):
    blood_group: str | None = Field(default=None, max_length=5)
    allergies: str | None = None
    chronic_conditions: str | None = None
    medications: str | None = None
    disabilities: str | None = None
    dietary_needs: str | None = Field(default=None, max_length=255)
    doctor_name: str | None = Field(default=None, max_length=120)
    doctor_phone: str | None = Field(default=None, max_length=30)
    insurance_provider: str | None = Field(default=None, max_length=120)
    insurance_number: str | None = Field(default=None, max_length=60)
    emergency_notes: str | None = None


class HealthOut(HealthInput):
    id: UUID
    student_id: UUID


# --- Discipline ------------------------------------------------------------


class DisciplineCreate(BaseModel):
    incident_date: dt.date
    category: str = Field(min_length=1, max_length=40)
    severity: str | None = Field(default=None, max_length=20)
    description: str = Field(min_length=1)
    action_taken: str | None = None
    status: str = "open"

    @field_validator("severity")
    @classmethod
    def _sev(cls, v: str | None) -> str | None:
        return _norm_choice(v, SEVERITIES, "severity")

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        return _norm_choice(v, DISCIPLINE_STATUS, "status") or "open"


class DisciplineUpdate(BaseModel):
    incident_date: dt.date | None = None
    category: str | None = Field(default=None, max_length=40)
    severity: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, min_length=1)
    action_taken: str | None = None
    status: str | None = None

    @field_validator("severity")
    @classmethod
    def _sev(cls, v: str | None) -> str | None:
        return _norm_choice(v, SEVERITIES, "severity")

    @field_validator("status")
    @classmethod
    def _status(cls, v: str | None) -> str | None:
        return _norm_choice(v, DISCIPLINE_STATUS, "status")


class DisciplineOut(BaseModel):
    id: UUID
    student_id: UUID
    incident_date: dt.date
    category: str
    severity: str | None
    description: str
    action_taken: str | None
    status: str
    recorded_by_user_id: UUID | None
    recorded_by_name: str | None = None
    created_at: dt.datetime
    # Denormalised so the school-wide log can show who it concerns.
    student_name: str | None = None
    student_number: str | None = None


# --- Student core ----------------------------------------------------------


class GuardianLinkOut(BaseModel):
    user_id: UUID
    name: str
    username: str
    email: str | None = None


class ParentPortalAccountOut(BaseModel):
    username: str
    temporary_password: str
    auto_created: bool = True


class _StudentProfileFields(BaseModel):
    middle_name: str | None = Field(default=None, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    nationality: str | None = Field(default=None, max_length=60)
    religion: str | None = Field(default=None, max_length=60)
    residence: str | None = Field(default=None, max_length=20)
    house: str | None = Field(default=None, max_length=60)
    hostel_id: UUID | None = None
    hostel_room_id: UUID | None = None
    admission_date: dt.date | None = None
    previous_school: str | None = Field(default=None, max_length=160)
    home_address: str | None = Field(default=None, max_length=255)
    village: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    photo_url: str | None = Field(default=None, max_length=500)


class StudentOut(_StudentProfileFields):
    id: UUID
    student_number: str
    first_name: str
    last_name: str
    lin: str | None
    class_id: UUID | None
    class_level: str | None
    class_label: str | None
    stream_id: UUID | None
    stream_name: str | None
    gender: str | None
    date_of_birth: dt.date | None
    status: str
    is_active: bool
    hostel_name: str | None = None
    hostel_room_name: str | None = None
    guardian: GuardianLinkOut | None = None
    guardian_count: int = 0
    portal_account: ParentPortalAccountOut | None = None


class StudentDetailOut(StudentOut):
    guardians: list[GuardianOut] = []
    health: HealthOut | None = None
    discipline: list[DisciplineOut] = []


class StudentCreate(_StudentProfileFields):
    # student_number is assigned automatically by the system (per-school scheme).
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    lin: str | None = Field(default=None, max_length=30)
    class_id: UUID | None = None
    stream_id: UUID | None = None
    gender: str | None = Field(default=None, max_length=10)
    date_of_birth: dt.date | None = None
    status: str = "enrolled"
    # Optional embedded data for the onboarding wizard (single atomic submit).
    guardians: list[GuardianInput] = []
    health: HealthInput | None = None

    @field_validator("gender")
    @classmethod
    def _gender(cls, v: str | None) -> str | None:
        return _norm_choice(v, GENDERS, "gender")

    @field_validator("residence")
    @classmethod
    def _residence(cls, v: str | None) -> str | None:
        return _norm_choice(v, RESIDENCES, "residence")

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        return _norm_choice(v, STATUSES, "status") or "enrolled"


class StudentUpdate(_StudentProfileFields):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    lin: str | None = Field(default=None, max_length=30)
    class_id: UUID | None = None
    stream_id: UUID | None = None
    gender: str | None = Field(default=None, max_length=10)
    date_of_birth: dt.date | None = None
    status: str | None = None
    is_active: bool | None = None
    clear_class: bool = False

    @field_validator("gender")
    @classmethod
    def _gender(cls, v: str | None) -> str | None:
        return _norm_choice(v, GENDERS, "gender")

    @field_validator("residence")
    @classmethod
    def _residence(cls, v: str | None) -> str | None:
        return _norm_choice(v, RESIDENCES, "residence")

    @field_validator("status")
    @classmethod
    def _status(cls, v: str | None) -> str | None:
        return _norm_choice(v, STATUSES, "status")


# --- Roster summary --------------------------------------------------------


class StreamRosterCount(BaseModel):
    stream_id: UUID
    name: str
    count: int


class ClassRosterCount(BaseModel):
    class_id: UUID
    level: str
    label: str
    count: int
    streams: list[StreamRosterCount]


class RosterSummaryOut(BaseModel):
    total: int
    unassigned: int
    classes: list[ClassRosterCount]


# --- Import ----------------------------------------------------------------


class StudentImportRow(BaseModel):
    # student_number is ignored on import — the system assigns it automatically.
    student_number: str | None = Field(default=None, max_length=20)
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    middle_name: str | None = Field(default=None, max_length=120)
    lin: str | None = Field(default=None, max_length=30)
    class_level: str | None = Field(default=None, max_length=10)
    stream_name: str | None = Field(default=None, max_length=50)
    gender: str | None = Field(default=None, max_length=10)
    date_of_birth: dt.date | None = None
    nationality: str | None = Field(default=None, max_length=60)
    religion: str | None = Field(default=None, max_length=60)
    residence: str | None = Field(default=None, max_length=20)
    admission_date: dt.date | None = None
    previous_school: str | None = Field(default=None, max_length=160)
    home_address: str | None = Field(default=None, max_length=255)
    village: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    # Primary guardian (required — flattened for spreadsheets)
    guardian_name: str | None = Field(default=None, max_length=160)
    guardian_relationship: str | None = Field(default=None, max_length=30)
    guardian_phone: str | None = Field(default=None, max_length=30)
    guardian_email: str | None = Field(default=None, max_length=255)
    # Health basics (blood_group required; others optional)
    blood_group: str | None = Field(default=None, max_length=5)
    allergies: str | None = None
    medical_conditions: str | None = None

    @field_validator("date_of_birth", "admission_date", mode="before")
    @classmethod
    def _parse_dates(cls, v: object, info) -> dt.date | None:
        label = "date_of_birth" if info.field_name == "date_of_birth" else "admission_date"
        return _parse_flexible_date(v, label=label)

    @field_validator("guardian_phone", mode="before")
    @classmethod
    def _normalize_guardian_phone(cls, v: object) -> str | None:
        return _normalize_spreadsheet_phone(v)

    @field_validator("class_level")
    @classmethod
    def _validate_class_level(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().upper()
        if not v:
            return None
        if v not in CLASS_LEVEL_VALUES:
            raise ValueError("class_level must be a valid nursery or primary level")
        return v

    @field_validator("gender")
    @classmethod
    def _gender(cls, v: str | None) -> str | None:
        return _norm_choice(v, GENDERS, "gender")

    @field_validator("residence")
    @classmethod
    def _residence(cls, v: str | None) -> str | None:
        return _norm_choice(v, RESIDENCES, "residence")


class StudentImportRequest(BaseModel):
    rows: list[StudentImportRow] = Field(min_length=1, max_length=1000)
    skip_duplicates: bool = True
    dry_run: bool = False
    line_offset: int = Field(default=0, ge=0)


class StudentImportRowResult(BaseModel):
    line: int
    identifier: str
    status: str
    message: str | None = None
    student_id: UUID | None = None


class StudentImportResponse(BaseModel):
    created: int
    skipped: int
    failed: int
    valid: int
    results: list[StudentImportRowResult]


# --- Bulk assign -----------------------------------------------------------


class BulkAssignRequest(BaseModel):
    student_ids: list[UUID] = Field(min_length=1, max_length=200)
    class_id: UUID | None = None
    stream_id: UUID | None = None
    clear_class: bool = False


class BulkAssignRowResult(BaseModel):
    student_id: UUID
    status: str
    message: str | None = None


class BulkAssignResponse(BaseModel):
    updated: int
    failed: int
    results: list[BulkAssignRowResult]

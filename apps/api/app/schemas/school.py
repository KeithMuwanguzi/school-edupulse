"""School onboarding / profile / module schemas (§6.2, §6.3)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import (
    BoardingStatus,
    Ownership,
    RegistrationStatus,
    SexComposition,
    TenantStatus,
)

SCHOOL_CODE_PATTERN = r"^[A-Z0-9]{4,8}$"


class AdminUserInput(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    login_id: str = Field(default="0001", max_length=20)
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr | None = None


class OnboardRequest(BaseModel):
    school_code: str
    name: str = Field(min_length=2, max_length=255)
    ownership: Ownership = Ownership.private
    motto: str | None = None
    emis_number: str | None = Field(default=None, max_length=32)
    license_number: str | None = None
    registration_status: RegistrationStatus = RegistrationStatus.unknown
    boarding_status: BoardingStatus = BoardingStatus.day
    sex_composition: SexComposition = SexComposition.mixed
    is_upe: bool = False
    district_id: UUID | None = None
    county_id: UUID | None = None
    sub_county_id: UUID | None = None
    parish_id: UUID | None = None
    address_line: str | None = None
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr
    head_teacher_name: str | None = None
    contact_person_name: str | None = None
    contact_person_phone: str | None = Field(default=None, max_length=20)
    contact_person_nin: str | None = Field(default=None, max_length=20)
    status: TenantStatus = TenantStatus.trial
    module_keys: list[str] = Field(min_length=1)
    admin_user: AdminUserInput

    @field_validator("school_code")
    @classmethod
    def _normalize_code(cls, v: str) -> str:
        v = v.strip().upper()
        import re

        if not re.match(SCHOOL_CODE_PATTERN, v):
            raise ValueError("school_code must be 4–8 uppercase letters/digits")
        return v

    @field_validator("module_keys")
    @classmethod
    def _ensure_core(cls, v: list[str]) -> list[str]:
        keys = list(dict.fromkeys(v))  # de-dupe, keep order
        if "core" not in keys:
            keys.insert(0, "core")
        return keys

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()


class AcademicYearOut(BaseModel):
    id: UUID
    label: str
    status: str
    starts_on: dt.date | None = None
    ends_on: dt.date | None = None


class TermOut(BaseModel):
    id: UUID
    term_number: int
    label: str
    status: str
    starts_on: dt.date | None = None
    ends_on: dt.date | None = None


class OnboardedAdmin(BaseModel):
    id: UUID
    username: str
    login_id: str


class OnboardResponse(BaseModel):
    tenant_id: UUID
    school_id: UUID
    school_code: str
    name: str
    status: str
    admin_user: OnboardedAdmin
    modules: list[str]
    academic_year: AcademicYearOut
    active_term: TermOut | None = None


class SchoolListItem(BaseModel):
    tenant_id: UUID
    school_id: UUID | None = None
    school_code: str
    name: str
    status: str
    ownership: str | None = None
    module_count: int = 0
    created_at: dt.datetime


class SchoolProfile(BaseModel):
    name: str
    motto: str | None = None
    badge_url: str | None = None
    ownership: str
    emis_number: str | None = None
    license_number: str | None = None
    registration_status: str
    boarding_status: str
    sex_composition: str
    is_upe: bool
    district_id: UUID | None = None
    county_id: UUID | None = None
    sub_county_id: UUID | None = None
    parish_id: UUID | None = None
    address_line: str | None = None
    phone: str | None = None
    email: str | None = None
    head_teacher_name: str | None = None
    contact_person_name: str | None = None
    contact_person_phone: str | None = None
    contact_person_nin: str | None = None
    timezone: str
    currency: str
    locale: str
    student_number_prefix: str | None = None
    report_footer_notes: str | None = None
    report_next_term_note: str | None = None
    version: int


class SchoolDetail(BaseModel):
    tenant_id: UUID
    school_id: UUID
    school_code: str
    status: str
    profile: SchoolProfile
    modules: list[str]
    created_at: dt.datetime


class SchoolUpdate(BaseModel):
    """PATCH — all optional. school_code and emis_number are not editable here."""

    name: str | None = Field(default=None, min_length=2, max_length=255)
    motto: str | None = None
    ownership: Ownership | None = None
    license_number: str | None = None
    registration_status: RegistrationStatus | None = None
    boarding_status: BoardingStatus | None = None
    sex_composition: SexComposition | None = None
    is_upe: bool | None = None
    district_id: UUID | None = None
    county_id: UUID | None = None
    sub_county_id: UUID | None = None
    parish_id: UUID | None = None
    address_line: str | None = None
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    head_teacher_name: str | None = None
    contact_person_name: str | None = None
    contact_person_phone: str | None = Field(default=None, max_length=20)
    student_number_prefix: str | None = Field(default=None, max_length=10)
    report_footer_notes: str | None = None
    report_next_term_note: str | None = Field(default=None, max_length=255)
    status: TenantStatus | None = None
    version: int | None = Field(default=None, description="optimistic lock check")

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: EmailStr | None) -> str | None:
        if v is None:
            return None
        return str(v).strip().lower()

    @field_validator("student_number_prefix")
    @classmethod
    def _validate_prefix(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        import re

        if not re.match(r"^\d{2,8}$", v):
            raise ValueError("student_number_prefix must be 2–8 digits")
        return v


class ModulesReplace(BaseModel):
    module_keys: list[str] = Field(min_length=1)

    @field_validator("module_keys")
    @classmethod
    def _ensure_core(cls, v: list[str]) -> list[str]:
        keys = list(dict.fromkeys(v))
        if "core" not in keys:
            keys.insert(0, "core")
        return keys


class AcademicContext(BaseModel):
    academic_year: AcademicYearOut | None = None
    active_term: TermOut | None = None


class PortalUser(BaseModel):
    id: UUID
    login_id: str
    username: str
    name: str
    role: str
    status: str
    email: str | None = None
    last_login_at: dt.datetime | None = None

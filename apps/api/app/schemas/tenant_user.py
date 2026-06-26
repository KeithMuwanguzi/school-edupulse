"""Tenant portal user schemas — Phase 2 §4."""
from __future__ import annotations

import datetime as dt
import re
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserStatus


def _clean_modules(v: list[str] | None) -> list[str] | None:
    """Normalize a module-keys list: strip, drop blanks, de-dupe, keep order."""
    if v is None:
        return None
    seen: list[str] = []
    for raw in v:
        key = (raw or "").strip()
        if key and key not in seen:
            seen.append(key)
    return seen


class RoleOption(BaseModel):
    role_key: str
    name: str
    description: str | None = None


class TenantUserOut(BaseModel):
    id: UUID
    login_id: str
    username: str
    name: str
    role: str
    status: str
    email: str | None = None
    # None = inherits the school's full module set; a list narrows access.
    allowed_modules: list[str] | None = None
    must_change_password: bool = False
    last_login_at: dt.datetime | None = None
    created_at: dt.datetime


class TenantUserCreate(BaseModel):
    login_id: str | None = Field(default=None, max_length=20)
    name: str = Field(min_length=2, max_length=255)
    role_key: str = Field(min_length=2, max_length=50)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    allowed_modules: list[str] | None = Field(default=None, max_length=64)

    @field_validator("login_id")
    @classmethod
    def _normalize_login_id(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not re.match(r"^[A-Za-z0-9_-]+$", v):
            raise ValueError("login_id must be letters, digits, _ or -")
        return v

    @field_validator("allowed_modules")
    @classmethod
    def _normalize_modules(cls, v: list[str] | None) -> list[str] | None:
        return _clean_modules(v)


class NextLoginIdOut(BaseModel):
    login_id: str


class TenantUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    role_key: str | None = Field(default=None, min_length=2, max_length=50)
    email: EmailStr | None = None
    status: UserStatus | None = None
    # Provide to change scoping; omit to leave unchanged. Pass null to clear.
    allowed_modules: list[str] | None = Field(default=None, max_length=64)

    @field_validator("allowed_modules")
    @classmethod
    def _normalize_modules(cls, v: list[str] | None) -> list[str] | None:
        return _clean_modules(v)


class PasswordResetResponse(BaseModel):
    message: str
    temporary_password: str | None = None
    email_sent: bool = False
    email_recipient: str | None = None


# Backward-compatible alias used in older imports/tests.
PasswordResetStubResponse = PasswordResetResponse


class TeacherImportRow(BaseModel):
    login_id: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr | None = None
    role_key: str = Field(default="teacher", max_length=50)


class GuardianImportRow(BaseModel):
    student_number: str = Field(min_length=4, max_length=20)
    guardian_name: str = Field(min_length=2, max_length=255)
    email: EmailStr | None = None
    student_first_name: str | None = Field(default=None, max_length=120)
    student_last_name: str | None = Field(default=None, max_length=120)


class TeacherImportRequest(BaseModel):
    rows: list[TeacherImportRow] = Field(min_length=1, max_length=500)
    default_password: str | None = Field(default=None, min_length=8, max_length=128)
    generate_passwords: bool = True


class GuardianImportRequest(BaseModel):
    rows: list[GuardianImportRow] = Field(min_length=1, max_length=500)
    default_password: str | None = Field(default=None, min_length=8, max_length=128)
    generate_passwords: bool = True


class ImportRowResult(BaseModel):
    line: int
    identifier: str
    status: str
    username: str | None = None
    temporary_password: str | None = None
    message: str | None = None


class ImportUsersResponse(BaseModel):
    created: int
    skipped: int
    failed: int
    results: list[ImportRowResult]

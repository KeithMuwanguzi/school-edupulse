"""Platform administrator schemas."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class PlatformAdminOut(BaseModel):
    id: UUID
    email: str
    name: str
    is_active: bool
    must_change_password: bool
    last_login_at: dt.datetime | None = None
    created_at: dt.datetime


class PlatformAdminCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    notify: bool = True


class PlatformAdminUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    is_active: bool | None = None


class PlatformAdminCreateResponse(BaseModel):
    admin: PlatformAdminOut
    message: str
    temporary_password: str | None = None
    email_sent: bool = False
    email_recipient: str | None = None

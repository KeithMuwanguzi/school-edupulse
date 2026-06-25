"""Auth request/response schemas (§6.1)."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class PlatformLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TenantLoginRequest(BaseModel):
    username: str = Field(min_length=3, description="login_id@school_code")
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token lifetime in seconds


class TenantSummary(BaseModel):
    id: UUID
    school_code: str
    name: str | None = None
    status: str


class MeResponse(BaseModel):
    id: UUID
    type: str  # platform_admin | tenant_user
    name: str
    email: str | None = None
    role: str
    login_id: str | None = None
    tenant: TenantSummary | None = None
    modules: list[str] = []

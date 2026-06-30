"""Auth request/response schemas (§6.1)."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.password_policy import validate_password_strength


class PlatformLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TenantLoginRequest(BaseModel):
    username: str = Field(min_length=3, description="login_id@school_code")
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int  # access token lifetime in seconds
    must_change_password: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value


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
    must_change_password: bool = False

"""Platform log viewer schemas (§4.6, §6.2)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, field_validator


class RequestLogItem(BaseModel):
    request_id: str
    method: str
    path: str
    status_code: int
    duration_ms: int
    tenant_id: UUID | None = None
    actor_type: str
    actor_id: UUID | None = None
    ip_address: str | None = None
    error_code: str | None = None
    created_at: dt.datetime

    @field_validator("ip_address", mode="before")
    @classmethod
    def _ip_to_str(cls, v):
        # asyncpg returns INET as an ipaddress object; serialize as string.
        return str(v) if v is not None else None


class ErrorLogItem(BaseModel):
    request_id: str
    level: str
    error_type: str | None = None
    error_code: str | None = None
    message: str
    endpoint: str | None = None
    tenant_id: UUID | None = None
    resolved_at: dt.datetime | None = None
    created_at: dt.datetime


class AuditLogItem(BaseModel):
    actor_type: str
    actor_id: UUID | None = None
    tenant_id: UUID | None = None
    action: str
    resource_type: str | None = None
    resource_id: UUID | None = None
    created_at: dt.datetime


class RequestTrail(BaseModel):
    request: RequestLogItem
    errors: list[ErrorLogItem]
    audit: list[AuditLogItem]

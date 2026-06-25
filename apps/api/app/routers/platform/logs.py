"""Platform log viewers — request trail, errors, single-request drill-down (§6.2)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_platform_session
from app.core.errors import NotFoundError
from app.models.audit import AuditLog
from app.models.logs import ApiRequestLog, ErrorLog
from app.schemas.logs import AuditLogItem, ErrorLogItem, RequestLogItem, RequestTrail

router = APIRouter(prefix="/platform/logs", tags=["platform:logs"])


@router.get("/requests", response_model=list[RequestLogItem])
async def request_logs(
    session: AsyncSession = Depends(get_platform_session),
    tenant_id: UUID | None = Query(default=None),
    status_code: int | None = Query(default=None),
    before: dt.datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[RequestLogItem]:
    stmt = select(ApiRequestLog).order_by(ApiRequestLog.created_at.desc()).limit(limit)
    if tenant_id:
        stmt = stmt.where(ApiRequestLog.tenant_id == tenant_id)
    if status_code:
        stmt = stmt.where(ApiRequestLog.status_code == status_code)
    if before:
        stmt = stmt.where(ApiRequestLog.created_at < before)
    rows = await session.scalars(stmt)
    return [RequestLogItem.model_validate(r, from_attributes=True) for r in rows]


@router.get("/errors", response_model=list[ErrorLogItem])
async def error_logs(
    session: AsyncSession = Depends(get_platform_session),
    tenant_id: UUID | None = Query(default=None),
    unresolved: bool = Query(default=False),
    before: dt.datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ErrorLogItem]:
    stmt = select(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(limit)
    if tenant_id:
        stmt = stmt.where(ErrorLog.tenant_id == tenant_id)
    if unresolved:
        stmt = stmt.where(ErrorLog.resolved_at.is_(None))
    if before:
        stmt = stmt.where(ErrorLog.created_at < before)
    rows = await session.scalars(stmt)
    return [ErrorLogItem.model_validate(r, from_attributes=True) for r in rows]


@router.get("/requests/{request_id}", response_model=RequestTrail)
async def request_trail(
    request_id: str,
    session: AsyncSession = Depends(get_platform_session),
) -> RequestTrail:
    req = await session.scalar(
        select(ApiRequestLog)
        .where(ApiRequestLog.request_id == request_id)
        .order_by(ApiRequestLog.created_at.desc())
        .limit(1)
    )
    if req is None:
        raise NotFoundError("No request found with that request_id.")

    errors = await session.scalars(
        select(ErrorLog).where(ErrorLog.request_id == request_id).order_by(
            ErrorLog.created_at.desc()
        )
    )
    audit = await session.scalars(
        select(AuditLog).where(AuditLog.request_id == request_id).order_by(
            AuditLog.created_at.desc()
        )
    )
    return RequestTrail(
        request=RequestLogItem.model_validate(req, from_attributes=True),
        errors=[ErrorLogItem.model_validate(e, from_attributes=True) for e in errors],
        audit=[AuditLogItem.model_validate(a, from_attributes=True) for a in audit],
    )

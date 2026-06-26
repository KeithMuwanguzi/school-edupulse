"""Platform log viewers — request trail, errors, audit export (§6.2)."""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_platform_session
from app.core.errors import NotFoundError, ValidationError
from app.models.audit import AuditLog
from app.models.logs import ApiRequestLog, ErrorLog
from app.schemas.logs import AuditLogFileItem, AuditLogItem, ErrorLogItem, RequestLogItem, RequestTrail
from app.services import platform_audit_file_service

router = APIRouter(prefix="/platform/logs", tags=["platform:logs"])


def _audit_item(row: AuditLog) -> AuditLogItem:
    return AuditLogItem(
        id=row.id,
        actor_type=row.actor_type.value if hasattr(row.actor_type, "value") else str(row.actor_type),
        actor_id=row.actor_id,
        tenant_id=row.tenant_id,
        action=row.action,
        resource_type=row.resource_type,
        resource_id=row.resource_id,
        request_id=row.request_id,
        metadata=row.audit_metadata,
        ip_address=str(row.ip_address) if row.ip_address is not None else None,
        created_at=row.created_at,
    )


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


@router.get("/audit", response_model=list[AuditLogItem])
async def audit_logs(
    session: AsyncSession = Depends(get_platform_session),
    tenant_id: UUID | None = Query(default=None),
    actor_type: str | None = Query(default=None),
    actor_id: UUID | None = Query(default=None),
    action: str | None = Query(default=None),
    before: dt.datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AuditLogItem]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if tenant_id:
        stmt = stmt.where(AuditLog.tenant_id == tenant_id)
    if actor_type:
        stmt = stmt.where(AuditLog.actor_type == actor_type)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    if before:
        stmt = stmt.where(AuditLog.created_at < before)
    rows = await session.scalars(stmt)
    return [_audit_item(r) for r in rows]


@router.get("/audit/export")
async def export_audit_logs(
    session: AsyncSession = Depends(get_platform_session),
    tenant_id: UUID | None = Query(default=None),
    actor_type: str | None = Query(default=None),
    actor_id: UUID | None = Query(default=None),
    action: str | None = Query(default=None),
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    limit: int = Query(default=5000, ge=1, le=10000),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if tenant_id:
        stmt = stmt.where(AuditLog.tenant_id == tenant_id)
    if actor_type:
        stmt = stmt.where(AuditLog.actor_type == actor_type)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    rows = list(await session.scalars(stmt))
    items = [_audit_item(r) for r in rows]
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%d-%H%M%S")

    if format == "json":
        payload = [item.model_dump(mode="json") for item in items]
        body = json.dumps(payload, indent=2, default=str)
        return StreamingResponse(
            iter([body]),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="audit-trail-{stamp}.json"'
            },
        )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "created_at",
            "action",
            "actor_type",
            "actor_id",
            "tenant_id",
            "resource_type",
            "resource_id",
            "request_id",
            "ip_address",
            "metadata",
        ]
    )
    for item in items:
        writer.writerow(
            [
                item.created_at.isoformat(),
                item.action,
                item.actor_type,
                str(item.actor_id or ""),
                str(item.tenant_id or ""),
                item.resource_type or "",
                str(item.resource_id or ""),
                item.request_id or "",
                item.ip_address or "",
                json.dumps(item.metadata or {}, default=str),
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="audit-trail-{stamp}.csv"'},
    )


@router.get("/files", response_model=list[AuditLogFileItem])
async def list_audit_files() -> list[AuditLogFileItem]:
    return [AuditLogFileItem.model_validate(item) for item in platform_audit_file_service.list_log_files()]


@router.get("/files/download")
async def download_audit_file(
    path: str = Query(..., min_length=5, max_length=200),
):
    try:
        target = platform_audit_file_service.resolve_log_path(path)
    except FileNotFoundError as exc:
        raise NotFoundError("Audit log file not found.") from exc
    except ValueError as exc:
        raise ValidationError("Invalid audit log path.") from exc

    return FileResponse(
        path=target,
        media_type="application/x-ndjson",
        filename=target.name,
    )


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
        audit=[_audit_item(a) for a in audit],
    )

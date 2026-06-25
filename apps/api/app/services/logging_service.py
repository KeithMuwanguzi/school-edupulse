"""LoggingService: structured stdout + DB persistence of request/error trails (§4.6).

Persistence failures never break the response — they emit a meta-error to stdout.
"""
from __future__ import annotations

import uuid
from typing import Any

from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.models.logs import ApiRequestLog, ErrorLog

log = get_logger("skulpulse.request")


async def persist_request_log(fields: dict[str, Any]) -> None:
    """Insert one api_request_logs row. Best-effort."""
    try:
        async with SessionLocal() as session:
            session.add(ApiRequestLog(id=uuid.uuid4(), **fields))
            await session.commit()
    except Exception as exc:  # noqa: BLE001 — logging must never raise
        log.error(
            "request_log.persist_failed",
            error=type(exc).__name__,
            detail=str(exc),
            request_id=fields.get("request_id"),
        )


async def persist_error_log(fields: dict[str, Any]) -> None:
    """Insert one error_logs row. Best-effort."""
    try:
        async with SessionLocal() as session:
            session.add(ErrorLog(id=uuid.uuid4(), **fields))
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        log.error(
            "error_log.persist_failed",
            error=type(exc).__name__,
            detail=str(exc),
            request_id=fields.get("request_id"),
        )

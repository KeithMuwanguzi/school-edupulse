"""Idempotency for unsafe mutations (§4.4).

Redis is the fast dedup store (24h TTL); idempotency_records is the durable
audit trail. Same key + same payload → cached response; same key + different
payload → 409.
"""
from __future__ import annotations

import datetime as dt
import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import IdempotencyConflictError
from app.core.redis import TTL_IDEMPOTENCY, idempotency_key, redis_client
from app.core.security import sha256_hex
from app.models.logs import IdempotencyRecord


def payload_hash(payload: dict) -> str:
    return sha256_hex(json.dumps(payload, sort_keys=True, default=str))


async def lookup(
    session: AsyncSession, key: str, endpoint: str, request_hash: str
) -> dict | None:
    """Return the cached response ({status, body}) for a replayed request, or None
    if this key is unused. Raises IdempotencyConflictError on payload mismatch."""
    raw = await redis_client.get(idempotency_key(key))
    record = json.loads(raw) if raw else None

    if record is None:
        row = await session.scalar(
            select(IdempotencyRecord).where(IdempotencyRecord.key == key)
        )
        if row is not None:
            record = {
                "endpoint": row.endpoint,
                "request_hash": row.request_hash,
                "status": row.response_status,
                "body": row.response_body,
            }

    if record is None:
        return None

    if record["endpoint"] != endpoint or record["request_hash"] != request_hash:
        raise IdempotencyConflictError(
            "This Idempotency-Key was used with a different request."
        )
    return {"status": record["status"], "body": record["body"]}


async def store(
    session: AsyncSession,
    key: str,
    endpoint: str,
    request_hash: str,
    status: int,
    body: dict,
    tenant_id: UUID | None = None,
) -> None:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "endpoint": endpoint,
        "request_hash": request_hash,
        "status": status,
        "body": body,
    }
    await redis_client.set(
        idempotency_key(key), json.dumps(payload, default=str), ex=TTL_IDEMPOTENCY
    )
    await session.execute(
        insert(IdempotencyRecord)
        .values(
            key=key,
            endpoint=endpoint,
            request_hash=request_hash,
            response_status=status,
            response_body=body,
            tenant_id=tenant_id,
            created_at=now,
            expires_at=now + dt.timedelta(seconds=TTL_IDEMPOTENCY),
        )
        .on_conflict_do_nothing(index_elements=["key"])
    )

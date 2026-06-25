"""Health + readiness checks. Health passes through logging middleware too (§4.6)."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.core.db import SessionLocal
from app.core.redis import redis_client

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "skulpulse-api"}


@router.get("/health/ready")
async def ready() -> dict:
    checks: dict[str, str] = {}
    # Postgres
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["postgres"] = f"error: {type(exc).__name__}"
    # Redis
    try:
        await redis_client.ping()
        checks["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = f"error: {type(exc).__name__}"

    healthy = all(v == "ok" for v in checks.values())
    return {"status": "ok" if healthy else "degraded", "checks": checks}

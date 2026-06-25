"""Redis client + cache key helpers (§4.1 hot paths, §4.4 idempotency)."""
from __future__ import annotations

from uuid import UUID

import redis.asyncio as aioredis

from app.core.config import settings

redis_client: aioredis.Redis = aioredis.from_url(
    settings.redis_url, encoding="utf-8", decode_responses=True
)


# --- Cache key builders --------------------------------------------------
def modules_key(tenant_id: UUID | str) -> str:
    return f"tenant:{tenant_id}:modules"


def profile_key(tenant_id: UUID | str) -> str:
    return f"tenant:{tenant_id}:profile"


def code_key(school_code: str) -> str:
    return f"tenant:code:{school_code.upper()}"


def idempotency_key(key: str) -> str:
    return f"idempotency:{key}"


def refresh_key(token_hash: str) -> str:
    return f"session:refresh:{token_hash}"


# TTLs (seconds)
TTL_MODULES = 5 * 60
TTL_PROFILE = 10 * 60
TTL_CODE = 60 * 60
TTL_IDEMPOTENCY = 24 * 60 * 60


async def get_redis() -> aioredis.Redis:
    return redis_client

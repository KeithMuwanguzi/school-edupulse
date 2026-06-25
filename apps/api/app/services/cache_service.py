"""Redis cache for hot paths (§4.1): module entitlements, code→tenant, profile.

All writes go through here so invalidation is centralized (§4.1 "publish from
service layer").
"""
from __future__ import annotations

import json
from uuid import UUID

from app.core import redis as r
from app.core.logging import get_logger

log = get_logger("skulpulse.cache")


# --- Module entitlements -------------------------------------------------
async def get_cached_modules(tenant_id: UUID) -> list[str] | None:
    raw = await r.redis_client.get(r.modules_key(tenant_id))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def set_cached_modules(tenant_id: UUID, modules: list[str]) -> None:
    await r.redis_client.set(
        r.modules_key(tenant_id), json.dumps(sorted(modules)), ex=r.TTL_MODULES
    )


async def invalidate_modules(tenant_id: UUID) -> None:
    await r.redis_client.delete(r.modules_key(tenant_id))
    log.info("cache.invalidate", key="modules", tenant_id=str(tenant_id))


# --- school_code → tenant_id --------------------------------------------
async def get_cached_tenant_id(school_code: str) -> str | None:
    return await r.redis_client.get(r.code_key(school_code))


async def set_cached_tenant_id(school_code: str, tenant_id: UUID) -> None:
    await r.redis_client.set(r.code_key(school_code), str(tenant_id), ex=r.TTL_CODE)


async def invalidate_tenant_code(school_code: str) -> None:
    await r.redis_client.delete(r.code_key(school_code))


# --- School profile ------------------------------------------------------
async def get_cached_profile(tenant_id: UUID) -> dict | None:
    raw = await r.redis_client.get(r.profile_key(tenant_id))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def set_cached_profile(tenant_id: UUID, profile: dict) -> None:
    await r.redis_client.set(
        r.profile_key(tenant_id), json.dumps(profile, default=str), ex=r.TTL_PROFILE
    )


async def invalidate_profile(tenant_id: UUID) -> None:
    await r.redis_client.delete(r.profile_key(tenant_id))
    log.info("cache.invalidate", key="profile", tenant_id=str(tenant_id))

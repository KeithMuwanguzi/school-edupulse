"""Redis sliding-window rate limiting with progressive backoff (§4.8)."""
from __future__ import annotations

import time

import structlog

from app.core.config import settings
from app.core.errors import RateLimitError
from app.core.redis import redis_client

log = structlog.get_logger("skulpulse.rate_limit")


class RateLimitResult:
    __slots__ = ("count", "limit", "retry_after_seconds")

    def __init__(self, count: int, limit: int, retry_after_seconds: int = 0) -> None:
        self.count = count
        self.limit = limit
        self.retry_after_seconds = retry_after_seconds


async def _is_blocked(key: str) -> int | None:
    """Return remaining block seconds if key is temporarily blocked."""
    ttl = await redis_client.ttl(f"ratelimit:block:{key}")
    if ttl and ttl > 0:
        return int(ttl)
    return None


async def _record_violation(key: str) -> None:
    """Track repeated limit breaches; block after threshold within the violation window."""
    vkey = f"ratelimit:violations:{key}"
    count = await redis_client.incr(vkey)
    if count == 1:
        await redis_client.expire(vkey, settings.rate_limit_violation_window_seconds)
    if count >= settings.rate_limit_violation_threshold:
        await redis_client.setex(
            f"ratelimit:block:{key}",
            settings.rate_limit_block_seconds,
            "1",
        )
        await redis_client.delete(vkey)
        log.warning(
            "rate_limit.blocked",
            key_prefix=key.split(":")[0],
            block_seconds=settings.rate_limit_block_seconds,
        )


async def sliding_window_hit(
    key: str,
    *,
    limit: int,
    window_seconds: int,
    label: str = "request",
) -> RateLimitResult:
    """Sliding-window counter; raises RateLimitError when over limit."""
    blocked_for = await _is_blocked(key)
    if blocked_for is not None:
        raise RateLimitError(
            f"Temporarily blocked due to repeated {label} attempts. "
            f"Try again in {blocked_for} seconds.",
            extra={"retry_after_seconds": blocked_for, "blocked": True},
        )

    now = time.time()
    window_start = now - window_seconds
    full_key = f"ratelimit:sw:{key}"

    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(full_key, 0, window_start)
    pipe.zadd(full_key, {f"{now}": now})
    pipe.zcard(full_key)
    pipe.expire(full_key, window_seconds + 1)
    results = await pipe.execute()
    count = int(results[2])

    if count > limit:
        oldest = await redis_client.zrange(full_key, 0, 0, withscores=True)
        retry_after = window_seconds
        if oldest:
            retry_after = max(1, int(window_seconds - (now - oldest[0][1])) + 1)
        await _record_violation(key)
        log.warning(
            "rate_limit.exceeded",
            key_prefix=key.split(":")[0],
            count=count,
            limit=limit,
            window_seconds=window_seconds,
            retry_after_seconds=retry_after,
        )
        raise RateLimitError(
            f"Too many {label}s. Try again in up to {retry_after} seconds.",
            extra={"retry_after_seconds": retry_after},
        )

    return RateLimitResult(count=count, limit=limit)


async def hit(key: str, limit: int, window_seconds: int) -> None:
    """Backward-compatible fixed-window helper (delegates to sliding window)."""
    await sliding_window_hit(key, limit=limit, window_seconds=window_seconds)


async def enforce_login_limits(ip: str | None, identifier: str) -> None:
    """Login throttling: per-IP + per-identifier with progressive backoff."""
    if ip:
        await sliding_window_hit(
            f"login:ip:{ip}",
            limit=settings.rate_limit_login_ip_per_minute,
            window_seconds=60,
            label="login attempt",
        )
    await sliding_window_hit(
        f"login:id:{identifier.lower()}",
        limit=settings.rate_limit_login_id_per_minute,
        window_seconds=60,
        label="login attempt",
    )


async def enforce_refresh_limits(ip: str | None) -> None:
    """Refresh token endpoint throttling to deter brute-force."""
    if not ip:
        return
    await sliding_window_hit(
        f"refresh:ip:{ip}",
        limit=settings.rate_limit_refresh_ip_per_minute,
        window_seconds=60,
        label="token refresh",
    )


async def enforce_api_limits(ip: str | None, user_id: str | None = None) -> None:
    """Global API throttling: burst (short) + sustained (long) per IP/user."""
    if not settings.rate_limit_api_enabled:
        return

    if ip:
        await sliding_window_hit(
            f"api:burst:ip:{ip}",
            limit=settings.rate_limit_api_burst,
            window_seconds=settings.rate_limit_api_burst_window_seconds,
            label="API request",
        )
        await sliding_window_hit(
            f"api:sustained:ip:{ip}",
            limit=settings.rate_limit_api_sustained_per_minute,
            window_seconds=60,
            label="API request",
        )

    if user_id:
        await sliding_window_hit(
            f"api:sustained:user:{user_id}",
            limit=settings.rate_limit_api_user_per_minute,
            window_seconds=60,
            label="API request",
        )

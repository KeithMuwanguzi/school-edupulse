"""Redis fixed-window rate limiting (§4.8)."""
from __future__ import annotations

from app.core.errors import RateLimitError
from app.core.redis import redis_client


async def hit(key: str, limit: int, window_seconds: int) -> None:
    """Increment the window counter; raise RateLimitError if over limit."""
    full_key = f"ratelimit:{key}"
    count = await redis_client.incr(full_key)
    if count == 1:
        await redis_client.expire(full_key, window_seconds)
    if count > limit:
        raise RateLimitError(
            f"Too many attempts. Try again in up to {window_seconds} seconds."
        )


async def enforce_login_limits(ip: str | None, identifier: str) -> None:
    """5/min/IP and 20/min/username (§4.8)."""
    if ip:
        await hit(f"login:ip:{ip}", limit=5, window_seconds=60)
    await hit(f"login:id:{identifier.lower()}", limit=20, window_seconds=60)

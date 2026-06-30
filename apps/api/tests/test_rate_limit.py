"""Rate limiting: sliding window, login/refresh/API enforcement, progressive backoff."""
from __future__ import annotations

import pytest

from app.core.errors import RateLimitError
from app.core.rate_limit import (
    enforce_api_limits,
    enforce_login_limits,
    enforce_refresh_limits,
    hit,
    sliding_window_hit,
)

pytestmark = pytest.mark.asyncio


async def test_rate_limit_helper_trips():
    key = "test:helper:trips"
    for _ in range(5):
        await hit(key, limit=5, window_seconds=60)
    with pytest.raises(RateLimitError) as exc_info:
        await hit(key, limit=5, window_seconds=60)
    assert exc_info.value.status_code == 429
    assert "retry_after_seconds" in exc_info.value.extra


async def test_sliding_window_allows_under_limit():
    result = await sliding_window_hit(
        "test:sw:under", limit=10, window_seconds=60, label="test"
    )
    assert result.count <= 10


async def test_login_limits_per_ip(client):
    """11th login attempt from same IP within a minute returns 429."""
    for i in range(10):
        resp = await client.post(
            "/api/v1/auth/platform/login",
            json={"email": f"ratelimit{i}@example.com", "password": "wrong"},
        )
        assert resp.status_code in (401, 429), resp.text
        if resp.status_code == 429:
            return
    blocked = await client.post(
        "/api/v1/auth/platform/login",
        json={"email": "ratelimit11@example.com", "password": "wrong"},
    )
    assert blocked.status_code == 429
    body = blocked.json()
    assert body["code"] == "RATE_LIMITED"
    assert blocked.headers.get("retry-after") is not None


async def test_refresh_rate_limit(client):
    """Refresh endpoint is throttled per IP."""
    for _ in range(31):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"},
        )
        if resp.status_code == 429:
            assert resp.json()["code"] == "RATE_LIMITED"
            return
    pytest.fail("Expected refresh endpoint to rate-limit after 30 attempts")


async def test_api_rate_limit_middleware(client, monkeypatch):
    """Burst API limit returns 429 when enabled."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "rate_limit_api_enabled", True)

    for _ in range(20):
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200

    over_limit = False
    for _ in range(60):
        resp = await client.get("/api/v1/auth/me")
        if resp.status_code == 429:
            over_limit = True
            break
    assert over_limit, "Expected global API rate limit to trigger"


async def test_enforce_api_limits_unit(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "rate_limit_api_enabled", True)
    key_ip = "127.0.0.99"
    for _ in range(50):
        await enforce_api_limits(key_ip, None)
    with pytest.raises(RateLimitError):
        await enforce_api_limits(key_ip, None)


async def test_enforce_login_limits_unit():
    await enforce_login_limits("10.0.0.1", "test@example.com")


async def test_enforce_refresh_limits_unit():
    await enforce_refresh_limits("10.0.0.2")

"""Platform authentication: login, refresh rotation, reuse detection (§11)."""
from __future__ import annotations

import pytest

from app.core.rate_limit import hit
from app.core.errors import RateLimitError

pytestmark = pytest.mark.asyncio

ADMIN_EMAIL = "admin@skulpulse.ug"
ADMIN_PASSWORD = "TestAdmin!2025"


async def _login(client) -> dict:
    resp = await client.post(
        "/api/v1/auth/platform/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_platform_login_success_and_me(client):
    tokens = await _login(client)
    assert tokens["access_token"] and tokens["refresh_token"]
    assert tokens["token_type"] == "bearer"

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    body = me.json()
    assert body["type"] == "platform_admin"
    assert body["email"] == ADMIN_EMAIL


async def test_login_wrong_password(client):
    resp = await client.post(
        "/api/v1/auth/platform/login",
        json={"email": ADMIN_EMAIL, "password": "wrong"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "INVALID_CREDENTIALS"


async def test_me_requires_token(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_refresh_rotation_and_reuse_detection(client):
    tokens = await _login(client)
    r1 = tokens["refresh_token"]

    # Rotate: r1 → new tokens.
    rotated = await client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert rotated.status_code == 200
    r2 = rotated.json()["refresh_token"]
    assert r2 != r1

    # Reusing r1 (already rotated) is detected and rejected.
    reuse = await client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert reuse.status_code == 401
    assert reuse.json()["code"] == "TOKEN_REUSE_DETECTED"

    # Reuse revoked the whole family — r2 no longer works either.
    after = await client.post("/api/v1/auth/refresh", json={"refresh_token": r2})
    assert after.status_code == 401


async def test_logout_revokes_refresh(client):
    tokens = await _login(client)
    r = tokens["refresh_token"]
    out = await client.post("/api/v1/auth/logout", json={"refresh_token": r})
    assert out.status_code == 204
    again = await client.post("/api/v1/auth/refresh", json={"refresh_token": r})
    assert again.status_code == 401


async def test_rate_limit_helper_trips():
    for _ in range(5):
        await hit("test:key", limit=5, window_seconds=60)
    with pytest.raises(RateLimitError):
        await hit("test:key", limit=5, window_seconds=60)


async def test_platform_login_sets_must_change_password(client, db):
    from sqlalchemy import update

    from app.models.platform import PlatformAdmin

    await db.execute(
        update(PlatformAdmin)
        .where(PlatformAdmin.email == ADMIN_EMAIL)
        .values(must_change_password=True)
    )
    await db.commit()

    tokens = await _login(client)
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["must_change_password"] is True


async def test_platform_api_blocked_until_password_changed(client, db):
    from sqlalchemy import update

    from app.models.platform import PlatformAdmin

    await db.execute(
        update(PlatformAdmin)
        .where(PlatformAdmin.email == ADMIN_EMAIL)
        .values(must_change_password=True)
    )
    await db.commit()

    tokens = await _login(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    blocked = await client.get("/api/v1/platform/schools", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "PASSWORD_CHANGE_REQUIRED"

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200


async def test_platform_change_password_clears_gate(client, db):
    from sqlalchemy import update

    from app.models.platform import PlatformAdmin

    await db.execute(
        update(PlatformAdmin)
        .where(PlatformAdmin.email == ADMIN_EMAIL)
        .values(must_change_password=True)
    )
    await db.commit()

    tokens = await _login(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    change = await client.post(
        "/api/v1/auth/platform/change-password",
        json={"current_password": ADMIN_PASSWORD, "new_password": "NewAdmin!2026"},
        headers=headers,
    )
    assert change.status_code == 200, change.text
    new_headers = {"Authorization": f"Bearer {change.json()['access_token']}"}

    me = await client.get("/api/v1/auth/me", headers=new_headers)
    assert me.status_code == 200
    assert me.json()["must_change_password"] is False

    schools = await client.get("/api/v1/platform/schools", headers=new_headers)
    assert schools.status_code == 200, schools.text

    # Restore seed password for other tests in the same session.
    from app.core.security import hash_password

    await db.execute(
        update(PlatformAdmin)
        .where(PlatformAdmin.email == ADMIN_EMAIL)
        .values(
            must_change_password=False,
            password_hash=hash_password(ADMIN_PASSWORD),
        )
    )
    await db.commit()

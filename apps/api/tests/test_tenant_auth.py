"""Tenant authentication: username parsing, scope, suspended schools (§11)."""
from __future__ import annotations

import pytest

from tests.conftest import sample_onboard_payload

pytestmark = pytest.mark.asyncio

PASSWORD = "ChangeMe!2025"


async def _onboard(client, admin_headers, code: str):
    resp = await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload(code), headers=admin_headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _login(client, username: str, password: str = PASSWORD):
    return await client.post(
        "/api/v1/auth/tenant/login", json={"username": username, "password": password}
    )


async def test_tenant_login_success_and_me(client, admin_headers):
    onboarded = await _onboard(client, admin_headers, "TLOG1")
    resp = await _login(client, "0001@TLOG1")
    assert resp.status_code == 200, resp.text
    tokens = resp.json()

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    body = me.json()
    assert body["type"] == "tenant_user"
    assert body["role"] == "school_admin"
    assert body["tenant"]["school_code"] == "TLOG1"
    assert "core" in body["modules"]
    assert body["tenant"]["id"] == onboarded["tenant_id"]


async def test_login_lowercase_school_code_normalized(client, admin_headers):
    await _onboard(client, admin_headers, "TLOG2")
    resp = await _login(client, "0001@tlog2")  # lowercase code
    assert resp.status_code == 200


async def test_wrong_school_code(client, admin_headers):
    await _onboard(client, admin_headers, "TLOG3")
    resp = await _login(client, "0001@NOPE9")
    assert resp.status_code == 401
    assert resp.json()["code"] == "INVALID_CREDENTIALS"


async def test_wrong_password(client, admin_headers):
    await _onboard(client, admin_headers, "TLOG4")
    resp = await _login(client, "0001@TLOG4", password="incorrect")
    assert resp.status_code == 401
    assert resp.json()["code"] == "INVALID_CREDENTIALS"


async def test_suspended_school_blocked(client, admin_headers):
    onboarded = await _onboard(client, admin_headers, "TLOG5")
    patch = await client.patch(
        f"/api/v1/platform/schools/{onboarded['tenant_id']}",
        json={"status": "suspended"},
        headers=admin_headers,
    )
    assert patch.status_code == 200
    resp = await _login(client, "0001@TLOG5")
    assert resp.status_code == 403
    assert resp.json()["code"] == "SCHOOL_SUSPENDED"


async def test_tenant_refresh_after_login(client, admin_headers):
    await _onboard(client, admin_headers, "TREF1")
    login = await _login(client, "0001@TREF1")
    assert login.status_code == 200
    r1 = login.json()["refresh_token"]

    rotated = await client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
    assert rotated.status_code == 200, rotated.text
    tokens = rotated.json()

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["type"] == "tenant_user"
    assert me.json()["tenant"]["school_code"] == "TREF1"

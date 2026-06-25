"""Platform admin — reset all tenant/operational data (keep platform admin login)."""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_reset_data_clears_schools_keeps_platform_admin(client, admin_headers):
    created = await client.post(
        "/api/v1/platform/schools",
        json={
            "school_code": "WIPE01",
            "name": "Wipe Test School",
            "ownership": "private",
            "phone": "+256700000001",
            "email": "wipe@test.ug",
            "head_teacher_name": "Test",
            "contact_person_name": "Test",
            "contact_person_phone": "+256700000002",
            "status": "trial",
            "module_keys": ["core", "students"],
            "admin_user": {
                "name": "Admin",
                "login_id": "0001",
                "password": "ChangeMe!2025",
            },
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text

    schools = await client.get("/api/v1/platform/schools", headers=admin_headers)
    assert schools.json()["items"]

    reset = await client.post(
        "/api/v1/platform/system/reset-data",
        json={"confirmation": "RESET ALL DATA"},
        headers=admin_headers,
    )
    assert reset.status_code == 200, reset.text
    body = reset.json()
    assert body["platform_admins_preserved"] >= 1
    assert body["tables_truncated"] > 0

    schools_after = await client.get("/api/v1/platform/schools", headers=admin_headers)
    assert schools_after.json()["items"] == []

    # Platform admin can still authenticate.
    login = await client.post(
        "/api/v1/auth/platform/login",
        json={"email": "admin@skulpulse.ug", "password": "TestAdmin!2025"},
    )
    assert login.status_code == 200, login.text


async def test_reset_data_requires_exact_confirmation(client, admin_headers):
    resp = await client.post(
        "/api/v1/platform/system/reset-data",
        json={"confirmation": "reset"},
        headers=admin_headers,
    )
    assert resp.status_code == 422


async def test_reset_data_disabled_when_flag_off(client, admin_headers, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "platform_allow_data_reset", False)

    resp = await client.post(
        "/api/v1/platform/system/reset-data",
        json={"confirmation": "RESET ALL DATA"},
        headers=admin_headers,
    )
    assert resp.status_code == 403

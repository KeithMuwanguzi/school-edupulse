"""Platform administrator management."""
from __future__ import annotations

import pytest


pytestmark = pytest.mark.asyncio


async def test_list_and_create_platform_admin(client, admin_headers):
    headers = admin_headers

    listed = await client.get("/api/v1/platform/admins", headers=headers)
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) >= 1

    created = await client.post(
        "/api/v1/platform/admins",
        json={
            "email": "ops.admin@example.com",
            "name": "Ops Admin",
            "password": "TempPass!2025",
            "notify": False,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["admin"]["email"] == "ops.admin@example.com"
    assert body["temporary_password"] == "TempPass!2025"
    admin_id = body["admin"]["id"]

    updated = await client.patch(
        f"/api/v1/platform/admins/{admin_id}",
        json={"name": "Operations Admin"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Operations Admin"

    deactivated = await client.patch(
        f"/api/v1/platform/admins/{admin_id}",
        json={"is_active": False},
        headers=headers,
    )
    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["is_active"] is False

    deleted = await client.delete(
        f"/api/v1/platform/admins/{admin_id}",
        headers=headers,
    )
    assert deleted.status_code == 204, deleted.text


async def test_audit_logs_and_export(client, admin_headers):
    headers = admin_headers

    audit = await client.get("/api/v1/platform/logs/audit", headers=headers)
    assert audit.status_code == 200, audit.text
    assert isinstance(audit.json(), list)

    export_csv = await client.get(
        "/api/v1/platform/logs/audit/export?format=csv&limit=10",
        headers=headers,
    )
    assert export_csv.status_code == 200, export_csv.text
    assert "text/csv" in export_csv.headers.get("content-type", "")
    assert "action" in export_csv.text

    files = await client.get("/api/v1/platform/logs/files", headers=headers)
    assert files.status_code == 200, files.text
    assert isinstance(files.json(), list)


async def test_cannot_delete_self(client, admin_headers):
    headers = admin_headers
    me = await client.get("/api/v1/auth/me", headers=headers)
    admin_id = me.json()["id"]

    resp = await client.delete(
        f"/api/v1/platform/admins/{admin_id}",
        headers=headers,
    )
    assert resp.status_code == 403

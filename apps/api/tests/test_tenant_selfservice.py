"""Tenant self-service: profile, modules, academic context (§11)."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def test_get_own_school(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SELF1")
    resp = await client.get("/api/v1/tenant/school", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["school_code"] == "SELF1"


async def test_patch_own_profile(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SELF2")
    resp = await client.patch(
        "/api/v1/tenant/school",
        json={"motto": "Strive for excellence", "head_teacher_name": "Mr. Okello"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["profile"]["motto"] == "Strive for excellence"
    assert body["profile"]["head_teacher_name"] == "Mr. Okello"


async def test_tenant_cannot_change_own_status_via_patch(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SELF3")
    resp = await client.patch(
        "/api/v1/tenant/school", json={"status": "active"}, headers=headers
    )
    assert resp.status_code == 200
    # status is ignored for tenant self-service; remains 'trial'.
    assert resp.json()["status"] == "trial"


async def test_get_modules_with_invoice(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "SELF4", module_keys=["core", "students", "finance"]
    )
    resp = await client.get("/api/v1/tenant/modules", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body["modules"]) == {"core", "students", "finance"}
    inv = body["invoice"]
    assert inv["platform_base_fee_ugx"] == 100000
    # students 150k + finance 250k = 400k modules; total 500k.
    assert inv["module_total_ugx"] == 400000
    assert inv["total_per_term_ugx"] == 500000


async def test_tenant_cannot_update_modules(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SELF5")
    resp = await client.put(
        "/api/v1/tenant/modules",
        json={"module_keys": ["core", "attendance"]},
        headers=headers,
    )
    assert resp.status_code == 405


async def test_academic_context_active_term(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SELF6")
    resp = await client.get("/api/v1/tenant/academic-context", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["academic_year"] is not None
    assert len(body["terms"]) == 3
    # env date 2026-06-15 → Term 2 active.
    assert body["active_term"]["term_number"] == 2

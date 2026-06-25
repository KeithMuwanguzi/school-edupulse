"""Tenant isolation at the API layer (§4.8, §11).

Complements the DB-level RLS tests (test_rls.py): a tenant user only ever sees
its own school and cannot reach platform routes.
"""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def test_tenant_user_sees_only_own_school(client, admin_headers):
    a_headers, a = await onboard_and_login(client, admin_headers, "ISOA")
    b_headers, b = await onboard_and_login(client, admin_headers, "ISOB")

    a_view = await client.get("/api/v1/tenant/school", headers=a_headers)
    assert a_view.json()["school_code"] == "ISOA"

    b_view = await client.get("/api/v1/tenant/school", headers=b_headers)
    assert b_view.json()["school_code"] == "ISOB"


async def test_tenant_user_cannot_access_platform_routes(client, admin_headers):
    a_headers, _ = await onboard_and_login(client, admin_headers, "ISOC")
    resp = await client.get("/api/v1/platform/schools", headers=a_headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "FORBIDDEN"


async def test_tenant_user_cannot_read_other_tenant_via_platform(client, admin_headers):
    a_headers, _ = await onboard_and_login(client, admin_headers, "ISOD")
    _, b = await onboard_and_login(client, admin_headers, "ISOE")
    # A's token attempts to read B's detail through the platform route → 403.
    resp = await client.get(
        f"/api/v1/platform/schools/{b['tenant_id']}", headers=a_headers
    )
    assert resp.status_code == 403


async def test_platform_admin_can_read_any_school(client, admin_headers):
    _, a = await onboard_and_login(client, admin_headers, "ISOF")
    resp = await client.get(
        f"/api/v1/platform/schools/{a['tenant_id']}", headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["school_code"] == "ISOF"

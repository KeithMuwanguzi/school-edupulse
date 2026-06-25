"""Module entitlement middleware gating (§4.2, §11)."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def test_gated_endpoint_allowed_when_subscribed(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "GATE1", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/students/roster-summary", headers=headers)
    assert resp.status_code == 200


async def test_gated_endpoint_blocked_when_not_subscribed(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "GATE2", module_keys=["core", "finance"]
    )
    resp = await client.get("/api/v1/tenant/students/roster-summary", headers=headers)
    assert resp.status_code == 403
    body = resp.json()
    assert body["code"] == "MODULE_NOT_SUBSCRIBED"
    assert body["module"] == "students"

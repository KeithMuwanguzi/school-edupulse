"""School onboarding + idempotency + module/profile mutations (§11)."""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import sample_onboard_payload

pytestmark = pytest.mark.asyncio


async def test_onboard_creates_full_tenant(client, admin_headers):
    resp = await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload(), headers=admin_headers
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["school_code"] == "STPETERS"
    assert body["admin_user"]["username"] == "0001@STPETERS"
    assert "core" in body["modules"]
    assert body["academic_year"]["label"]
    # active_term present for a mid-year onboard (env date 2026-06-15 → Term 2).
    assert body["active_term"] is not None

    # Detail endpoint reflects it.
    detail = await client.get(
        f"/api/v1/platform/schools/{body['tenant_id']}", headers=admin_headers
    )
    assert detail.status_code == 200
    assert detail.json()["profile"]["name"] == "St. Peter's Primary School"


async def test_onboard_is_idempotent(client, admin_headers):
    key = str(uuid.uuid4())
    headers = {**admin_headers, "Idempotency-Key": key}
    payload = sample_onboard_payload("KAMPPS")

    first = await client.post("/api/v1/platform/schools", json=payload, headers=headers)
    second = await client.post("/api/v1/platform/schools", json=payload, headers=headers)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["tenant_id"] == second.json()["tenant_id"]

    # Only one tenant created.
    listing = await client.get(
        "/api/v1/platform/schools?status=trial", headers=admin_headers
    )
    codes = [i["school_code"] for i in listing.json()["items"]]
    assert codes.count("KAMPPS") == 1


async def test_idempotency_key_conflict_on_different_payload(client, admin_headers):
    key = str(uuid.uuid4())
    headers = {**admin_headers, "Idempotency-Key": key}
    await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload("AAAA1"), headers=headers
    )
    resp = await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload("BBBB2"), headers=headers
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "IDEMPOTENCY_KEY_REUSED"


async def test_duplicate_school_code_rejected(client, admin_headers):
    await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload("DUPE1"), headers=admin_headers
    )
    resp = await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload("DUPE1"), headers=admin_headers
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "DUPLICATE_SCHOOL_CODE"


async def test_replace_modules_updates_set(client, admin_headers):
    created = await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload("MODS1"), headers=admin_headers
    )
    tenant_id = created.json()["tenant_id"]
    resp = await client.put(
        f"/api/v1/platform/schools/{tenant_id}/modules",
        json={"module_keys": ["core", "finance"]},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    modules = set(resp.json()["modules"])
    assert modules == {"core", "finance"}
    assert "students" not in modules


async def test_patch_profile_and_optimistic_lock(client, admin_headers):
    created = await client.post(
        "/api/v1/platform/schools", json=sample_onboard_payload("PATCH1"), headers=admin_headers
    )
    tenant_id = created.json()["tenant_id"]

    ok = await client.patch(
        f"/api/v1/platform/schools/{tenant_id}",
        json={"motto": "Knowledge is power", "version": 1},
        headers=admin_headers,
    )
    assert ok.status_code == 200
    assert ok.json()["profile"]["motto"] == "Knowledge is power"
    assert ok.json()["profile"]["version"] == 2

    # Stale version rejected.
    stale = await client.patch(
        f"/api/v1/platform/schools/{tenant_id}",
        json={"motto": "Again", "version": 1},
        headers=admin_headers,
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "STALE_VERSION"


async def test_onboard_requires_admin(client):
    resp = await client.post("/api/v1/platform/schools", json=sample_onboard_payload("NOAUTH1"))
    assert resp.status_code == 401

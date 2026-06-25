"""Enrollment completeness validation on student create."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload, import_row_payload

pytestmark = pytest.mark.asyncio


async def test_rejects_incomplete_enrollment(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "ENR1",
        module_keys=["core", "students", "academics"],
    )
    created_class = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P4"},
        headers=headers,
    )
    class_id = created_class.json()["id"]

    resp = await client.post(
        "/api/v1/tenant/students",
        json={"first_name": "Incomplete", "last_name": "Learner", "class_id": class_id},
        headers=headers,
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "VALIDATION_ERROR"


async def test_accepts_complete_enrollment(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "ENR2",
        module_keys=["core", "students", "academics"],
    )
    created_class = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P5", "label": "Primary Five"},
        headers=headers,
    )
    class_id = created_class.json()["id"]

    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            first_name="Complete",
            last_name="Learner",
            residence="boarder",
        ),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["class_level"] == "P5"
    assert body["residence"] == "boarder"


async def test_import_rejects_incomplete_row(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "ENR3",
        module_keys=["core", "students", "academics"],
    )
    await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P3"},
        headers=headers,
    )

    resp = await client.post(
        "/api/v1/tenant/students/import",
        json={
            "rows": [
                {
                    "first_name": "Sparse",
                    "last_name": "Import",
                    "class_level": "P3",
                },
            ],
            "dry_run": True,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["valid"] == 0
    assert body["failed"] == 1
    assert "gender is required" in (body["results"][0]["message"] or "")


async def test_import_accepts_complete_row(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "ENR4",
        module_keys=["core", "students", "academics"],
    )
    await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P6"},
        headers=headers,
    )

    resp = await client.post(
        "/api/v1/tenant/students/import",
        json={
            "rows": [import_row_payload(class_level="P6", first_name="Bulk", last_name="Ready")],
            "dry_run": True,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["valid"] == 1
    assert resp.json()["failed"] == 0

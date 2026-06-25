"""Phase 2 §14 — admissions pipeline."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

pytestmark = pytest.mark.asyncio


async def _headers(client, admin_headers, code: str):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        code,
        module_keys=["core", "students", "admissions", "academics"],
    )
    return headers


async def test_module_gate_blocks_without_admissions(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "ADM2", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/admissions/applications", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "MODULE_NOT_SUBSCRIBED"
    assert resp.json()["module"] == "admissions"


async def test_create_and_list_application(client, admin_headers):
    headers = await _headers(client, admin_headers, "ADM3")
    resp = await client.post(
        "/api/v1/tenant/admissions/applications",
        json={
            "first_name": "Kato",
            "last_name": "Okello",
            "applied_class_level": "P3",
            "guardian_name": "Sarah Nakimera",
            "guardian_phone": "+256700111222",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "application"
    assert body["reference_number"].startswith("ADM-")
    assert body["first_name"] == "Kato"

    listed = await client.get("/api/v1/tenant/admissions/applications", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_status_transitions(client, admin_headers):
    headers = await _headers(client, admin_headers, "ADM4")
    created = await client.post(
        "/api/v1/tenant/admissions/applications",
        json={"first_name": "Amina", "last_name": "Namuli", "applied_class_level": "P1"},
        headers=headers,
    )
    app_id = created.json()["id"]

    for status in ("interview", "accepted"):
        resp = await client.patch(
            f"/api/v1/tenant/admissions/applications/{app_id}",
            json={"status": status},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == status

    bad = await client.patch(
        f"/api/v1/tenant/admissions/applications/{app_id}",
        json={"status": "application"},
        headers=headers,
    )
    assert bad.status_code == 422


async def test_batch_create_applications(client, admin_headers):
    headers = await _headers(client, admin_headers, "ADM6")
    resp = await client.post(
        "/api/v1/tenant/admissions/applications/batch",
        json={
            "rows": [
                {"first_name": "Kato", "last_name": "Okello", "applied_class_level": "P2"},
                {"first_name": "Amina", "last_name": "Namuli", "applied_class_level": "P3"},
                {"first_name": "", "last_name": "BadRow"},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["created"] == 2
    assert body["failed"] == 1
    assert len(body["results"]) == 3

    listed = await client.get("/api/v1/tenant/admissions/applications", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 2


async def test_withdraw_and_reopen_application(client, admin_headers):
    headers = await _headers(client, admin_headers, "ADM7")
    created = await client.post(
        "/api/v1/tenant/admissions/applications",
        json={"first_name": "Sam", "last_name": "Okello", "applied_class_level": "P2"},
        headers=headers,
    )
    app_id = created.json()["id"]

    missing_reason = await client.patch(
        f"/api/v1/tenant/admissions/applications/{app_id}",
        json={"status": "withdrawn"},
        headers=headers,
    )
    assert missing_reason.status_code == 422

    withdrawn = await client.patch(
        f"/api/v1/tenant/admissions/applications/{app_id}",
        json={"status": "withdrawn", "withdrawal_reason": "rejected"},
        headers=headers,
    )
    assert withdrawn.status_code == 200, withdrawn.text
    body = withdrawn.json()
    assert body["status"] == "withdrawn"
    assert body["withdrawal_reason"] == "rejected"

    reopened = await client.patch(
        f"/api/v1/tenant/admissions/applications/{app_id}",
        json={"status": "application"},
        headers=headers,
    )
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["status"] == "application"
    assert reopened.json()["withdrawal_reason"] is None


async def test_link_enrolled_student(client, admin_headers):
    headers = await _headers(client, admin_headers, "ADM5")
    class_resp = await client.post(
        "/api/v1/tenant/classes", json={"level": "P2"}, headers=headers
    )
    class_id = class_resp.json()["id"]

    app_resp = await client.post(
        "/api/v1/tenant/admissions/applications",
        json={
            "first_name": "Brian",
            "last_name": "Mukasa",
            "applied_class_level": "P2",
            "applied_class_id": class_id,
        },
        headers=headers,
    )
    app_id = app_resp.json()["id"]
    await client.patch(
        f"/api/v1/tenant/admissions/applications/{app_id}",
        json={"status": "interview"},
        headers=headers,
    )
    await client.patch(
        f"/api/v1/tenant/admissions/applications/{app_id}",
        json={"status": "accepted"},
        headers=headers,
    )

    student_resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            first_name="Brian",
            last_name="Mukasa",
        ),
        headers=headers,
    )
    assert student_resp.status_code == 201, student_resp.text
    student_id = student_resp.json()["id"]

    linked = await client.post(
        f"/api/v1/tenant/admissions/applications/{app_id}/enroll",
        json={"student_id": student_id},
        headers=headers,
    )
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert body["status"] == "enrolled"
    assert body["student_id"] == student_id

"""Parent portal — shared credentials per pupil + subscription gating."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

PORTAL_MODULES = ["core", "students", "academics", "communication", "parents_portal"]
FULL_PARENT_MODULES = [
    *PORTAL_MODULES,
    "reportcards",
    "finance",
    "attendance",
]


async def _parent_headers(client, admin_headers, code: str, *, modules: list[str] | None = None):
    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        code,
        module_keys=modules or PORTAL_MODULES,
    )
    school_code = onboard["school_code"]
    class_id = (
        await client.post(
            "/api/v1/tenant/classes",
            json={"level": "P4"},
            headers=headers,
        )
    ).json()["id"]
    enrolled = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, first_name="Amina", last_name="Nabukeera"),
        headers=headers,
    )
    assert enrolled.status_code == 201, enrolled.text
    student_number = enrolled.json()["student_number"]
    student_id = enrolled.json()["id"]

    await client.post(
        f"/api/v1/tenant/students/{student_id}/guardians",
        json={
            "relationship": "mother",
            "full_name": "Mary Namuli",
            "phone_primary": "+256700111222",
            "is_primary": True,
        },
        headers=headers,
    )
    await client.post(
        f"/api/v1/tenant/students/{student_id}/guardians",
        json={
            "relationship": "father",
            "full_name": "Peter Namuli",
            "phone_primary": "+256700333444",
        },
        headers=headers,
    )

    import_resp = await client.post(
        "/api/v1/tenant/users/import/guardians",
        json={
            "rows": [{"student_number": student_number, "guardian_name": "Mary Namuli"}],
            "default_password": "ParentPass!25",
            "generate_passwords": False,
        },
        headers=headers,
    )
    assert import_resp.status_code == 200, import_resp.text

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"{student_number}@{school_code}", "password": "ParentPass!25"},
    )
    assert login.status_code == 200, login.text
    parent_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return parent_headers, student_number, school_code, headers


@pytest.mark.asyncio
async def test_parent_overview_returns_linked_child(client, admin_headers):
    parent_headers, student_number, school_code, _ = await _parent_headers(
        client, admin_headers, "PAR1"
    )

    resp = await client.get("/api/v1/tenant/parent/overview", headers=parent_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["portal_username"] == f"{student_number}@{school_code}"
    assert body["child"]["student_number"] == student_number
    assert body["child"]["first_name"] == "Amina"
    assert len(body["guardians"]) == 2
    assert body["guardians"][0]["full_name"] == "Mary Namuli"


@pytest.mark.asyncio
async def test_parent_overview_forbidden_for_staff(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "PAR2", module_keys=PORTAL_MODULES
    )
    resp = await client.get("/api/v1/tenant/parent/overview", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_second_guardian_import_skipped_same_login(client, admin_headers):
    _parent_headers, student_number, school_code, admin = await _parent_headers(
        client, admin_headers, "PAR3"
    )

    second = await client.post(
        "/api/v1/tenant/users/import/guardians",
        json={
            "rows": [{"student_number": student_number, "guardian_name": "Peter Namuli"}],
            "default_password": "OtherPass!25",
            "generate_passwords": False,
        },
        headers=admin,
    )
    assert second.json()["skipped"] == 1

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"{student_number}@{school_code}", "password": "ParentPass!25"},
    )
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_guardian_import_blocked_without_parents_portal_module(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "PAR4",
        module_keys=["core", "students", "academics"],
    )
    resp = await client.post(
        "/api/v1/tenant/users/import/guardians",
        json={
            "rows": [{"student_number": "12345678", "guardian_name": "Jane Guardian"}],
            "default_password": "ParentPass!25",
            "generate_passwords": False,
        },
        headers=headers,
    )
    assert resp.status_code == 403
    assert "Parent Portal" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_parent_login_blocked_without_parents_portal_module(client, admin_headers):
    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "PAR5",
        module_keys=["core", "students", "academics", "parents_portal"],
    )
    school_code = onboard["school_code"]
    class_id = (
        await client.post(
            "/api/v1/tenant/classes",
            json={"level": "P4"},
            headers=headers,
        )
    ).json()["id"]
    enrolled = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, first_name="Tom", last_name="Okello"),
        headers=headers,
    )
    student_number = enrolled.json()["student_number"]

    await client.post(
        "/api/v1/tenant/users/import/guardians",
        json={
            "rows": [{"student_number": student_number, "guardian_name": "Guardian One"}],
            "default_password": "ParentPass!25",
            "generate_passwords": False,
        },
        headers=headers,
    )

    # Deactivate parent portal module
    tenant_id = onboard["tenant_id"]
    platform = admin_headers
    await client.put(
        f"/api/v1/platform/schools/{tenant_id}/modules",
        json={"module_keys": ["core", "students", "academics"]},
        headers=platform,
    )

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"{student_number}@{school_code}", "password": "ParentPass!25"},
    )
    assert login.status_code == 403
    assert "parent portal" in login.json()["detail"].lower()


@pytest.mark.asyncio
async def test_enrollment_auto_provisions_parent_portal_account(client, admin_headers):
    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "PAR6",
        module_keys=PORTAL_MODULES,
    )
    class_id = (
        await client.post(
            "/api/v1/tenant/classes",
            json={"level": "P4"},
            headers=headers,
        )
    ).json()["id"]
    payload = enrollment_payload(class_id=class_id, first_name="Zara", last_name="Mirembe")
    payload["guardians"] = [
        {
            "relationship": "mother",
            "full_name": "Grace Mirembe",
            "phone_primary": "+256700999888",
            "email": "grace.mirembe@example.com",
            "is_primary": True,
        }
    ]
    resp = await client.post("/api/v1/tenant/students", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["portal_account"] is not None
    assert body["portal_account"]["username"].startswith(body["student_number"])
    assert len(body["portal_account"]["temporary_password"]) >= 8

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={
            "username": body["portal_account"]["username"],
            "password": body["portal_account"]["temporary_password"],
        },
    )
    assert login.status_code == 200

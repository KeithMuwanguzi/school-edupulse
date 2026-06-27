"""Phase 2 §6 — teachers & assignments."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def _headers(client, admin_headers, code: str):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        code,
        module_keys=["core", "students", "teachers", "academics"],
    )
    return headers


async def _create_teacher(client, headers, login_id: str = "0002") -> str:
    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": login_id,
            "name": "Grace Namuli",
            "role_key": "teacher",
            "email": f"{login_id}@test.school.ug",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_class(client, headers, level: str = "P3") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": level},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_subject(client, headers, code: str, cycle: str) -> str:
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": code, "name": code.title(), "ncdc_cycle": cycle},
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def test_module_gate_blocks_without_teachers(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "TCH1", module_keys=["core", "academics"]
    )
    resp = await client.get("/api/v1/tenant/teachers/staff", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "MODULE_NOT_SUBSCRIBED"
    assert resp.json()["module"] == "teachers"


async def test_list_staff_empty(client, admin_headers):
    headers = await _headers(client, admin_headers, "TCH2")
    resp = await client.get("/api/v1/tenant/teachers/staff", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_staff_with_teacher(client, admin_headers):
    headers = await _headers(client, admin_headers, "TCH3")
    await _create_teacher(client, headers)

    resp = await client.get("/api/v1/tenant/teachers/staff", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["role"] == "teacher"
    assert body[0]["assignment_count"] == 0


async def test_create_and_list_assignment(client, admin_headers):
    headers = await _headers(client, admin_headers, "TCH4")
    teacher_id = await _create_teacher(client, headers)
    class_id = await _create_class(client, headers, "P3")
    subject_id = await _create_subject(client, headers, "ENG", "cycle_1")

    created = await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "is_class_teacher": True,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["class_level"] == "P3"
    assert body["subject_code"] == "ENG"
    assert body["is_class_teacher"] is True

    listed = await client.get(
        f"/api/v1/tenant/teachers/assignments?teacher_user_id={teacher_id}",
        headers=headers,
    )
    assert len(listed.json()) == 1

    staff = await client.get("/api/v1/tenant/teachers/staff", headers=headers)
    assert staff.json()[0]["assignment_count"] == 1


async def test_duplicate_assignment_rejected(client, admin_headers):
    headers = await _headers(client, admin_headers, "TCH5")
    teacher_id = await _create_teacher(client, headers)
    class_id = await _create_class(client, headers, "P4")
    subject_id = await _create_subject(client, headers, "MATH", "cycle_2")

    payload = {
        "teacher_user_id": teacher_id,
        "class_id": class_id,
        "subject_id": subject_id,
    }
    assert (
        await client.post("/api/v1/tenant/teachers/assignments", json=payload, headers=headers)
    ).status_code == 201
    dup = await client.post(
        "/api/v1/tenant/teachers/assignments", json=payload, headers=headers
    )
    assert dup.status_code == 409


async def test_subject_cycle_mismatch(client, admin_headers):
    headers = await _headers(client, admin_headers, "TCH6")
    teacher_id = await _create_teacher(client, headers)
    class_id = await _create_class(client, headers, "P6")
    subject_id = await _create_subject(client, headers, "SCI", "cycle_1")

    resp = await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
        },
        headers=headers,
    )
    assert resp.status_code == 422
    assert "not taught" in resp.json()["detail"].lower()


async def test_delete_assignment(client, admin_headers):
    headers = await _headers(client, admin_headers, "TCH7")
    teacher_id = await _create_teacher(client, headers)
    class_id = await _create_class(client, headers, "P5")
    subject_id = await _create_subject(client, headers, "SST", "cycle_3")

    created = await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
        },
        headers=headers,
    )
    assignment_id = created.json()["id"]
    assert (
        await client.delete(
            f"/api/v1/tenant/teachers/assignments/{assignment_id}",
            headers=headers,
        )
    ).status_code == 204

    listed = await client.get("/api/v1/tenant/teachers/assignments", headers=headers)
    assert listed.json() == []

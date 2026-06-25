"""Term registration — config + collaborative per-term workflow."""
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
        module_keys=["core", "students", "academics"],
    )
    return headers


async def _create_class(client, headers, level: str = "P3") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": level},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _ensure_class(client, headers, level: str = "P3") -> str:
    listed = await client.get("/api/v1/tenant/classes", headers=headers)
    assert listed.status_code == 200, listed.text
    for row in listed.json():
        if row["level"] == level:
            return row["id"]
    return await _create_class(client, headers, level)


async def _create_student(client, headers) -> str:
    class_id = await _ensure_class(client, headers)
    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, first_name="Term", last_name="Pupil"),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_config_seeds_defaults(client, admin_headers):
    headers = await _headers(client, admin_headers, "TRG1")
    resp = await client.get("/api/v1/tenant/registration/config", headers=headers)
    assert resp.status_code == 200, resp.text
    sections = resp.json()["sections"]
    assert len(sections) >= 3
    slugs = {s["slug"] for s in sections}
    assert "finance" in slugs
    assert "health" in slugs
    finance = next(s for s in sections if s["slug"] == "finance")
    assert any(r["slug"] == "fees_paid" for r in finance["requirements"])


async def test_admin_can_add_requirement(client, admin_headers):
    headers = await _headers(client, admin_headers, "TRG2")
    config = await client.get("/api/v1/tenant/registration/config", headers=headers)
    section_id = config.json()["sections"][0]["id"]
    resp = await client.post(
        f"/api/v1/tenant/registration/sections/{section_id}/requirements",
        json={"label": "Custom check", "field_type": "checkbox", "is_required": False},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["label"] == "Custom check"


async def test_start_registration_for_onboarded_student(client, admin_headers):
    headers = await _headers(client, admin_headers, "TRG3")
    student_id = await _create_student(client, headers)

    start = await client.post(
        "/api/v1/tenant/registration",
        json={"student_id": student_id},
        headers=headers,
    )
    assert start.status_code == 201, start.text
    body = start.json()
    assert body["student_id"] == student_id
    assert body["status"] == "in_progress"
    assert len(body["sections"]) >= 3

    dup = await client.post(
        "/api/v1/tenant/registration",
        json={"student_id": student_id},
        headers=headers,
    )
    assert dup.status_code == 201
    assert dup.json()["id"] == body["id"]


async def test_section_responses_and_auto_complete(client, admin_headers):
    headers = await _headers(client, admin_headers, "TRG4")
    student_id = await _create_student(client, headers)
    reg = await client.post(
        "/api/v1/tenant/registration",
        json={"student_id": student_id},
        headers=headers,
    )
    detail = reg.json()
    reg_id = detail["id"]

    # Satisfy all required requirements across sections
    responses = []
    for sec in detail["sections"]:
        for req in sec["requirements"]:
            if req["is_required"]:
                val = True if req["field_type"] == "checkbox" else "ok"
                responses.append(
                    {"requirement_id": req["id"], "value": val, "status": "satisfied"}
                )

    upd = await client.put(
        f"/api/v1/tenant/registration/{reg_id}/responses",
        json={"responses": responses},
        headers=headers,
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["status"] == "complete"
    assert upd.json()["required_done"] == upd.json()["required_total"]


async def test_queue_and_summary(client, admin_headers):
    headers = await _headers(client, admin_headers, "TRG5")
    sid = await _create_student(client, headers)
    await client.post("/api/v1/tenant/registration", json={"student_id": sid}, headers=headers)

    summary = await client.get("/api/v1/tenant/registration/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["total_students"] == 1
    assert summary.json()["in_progress"] == 1

    queue = await client.get("/api/v1/tenant/registration/queue", headers=headers)
    assert queue.status_code == 200
    assert len(queue.json()) == 1
    assert queue.json()[0]["student_id"] == sid


async def test_teacher_can_update_responses(client, admin_headers):
    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "TRG6",
        module_keys=["core", "students", "academics"],
    )
    # Create teacher user
    teacher = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0099",
            "name": "Desk Teacher",
            "role_key": "teacher",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert teacher.status_code == 201

    sid = await _create_student(client, headers)
    reg = await client.post(
        "/api/v1/tenant/registration",
        json={"student_id": sid},
        headers=headers,
    )
    reg_id = reg.json()["id"]
    req_id = reg.json()["sections"][0]["requirements"][0]["id"]

    code = onboard["school_code"]
    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0099@{code}", "password": "TempPass!2025"},
    )
    assert login.status_code == 200
    t_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    upd = await client.put(
        f"/api/v1/tenant/registration/{reg_id}/responses",
        json={
            "responses": [
                {"requirement_id": req_id, "value": True, "status": "satisfied"},
            ]
        },
        headers=t_headers,
    )
    assert upd.status_code == 200, upd.text


async def _complete_registration(client, headers, student_id: str) -> None:
    start = await client.post(
        "/api/v1/tenant/registration",
        json={"student_id": student_id},
        headers=headers,
    )
    assert start.status_code == 201, start.text
    detail = start.json()
    responses = []
    for sec in detail["sections"]:
        for req in sec["requirements"]:
            if req["is_required"]:
                val = True if req["field_type"] == "checkbox" else "ok"
                responses.append(
                    {"requirement_id": req["id"], "value": val, "status": "satisfied"}
                )
    upd = await client.put(
        f"/api/v1/tenant/registration/{detail['id']}/responses",
        json={"responses": responses},
        headers=headers,
    )
    assert upd.status_code == 200, upd.text


async def test_registered_roster_lists_complete_only(client, admin_headers):
    headers = await _headers(client, admin_headers, "TRG7")
    class_resp = await client.post(
        "/api/v1/tenant/classes", json={"level": "P3"}, headers=headers
    )
    assert class_resp.status_code == 201
    class_id = class_resp.json()["id"]

    registered_id = await _create_student(client, headers)
    await client.patch(
        f"/api/v1/tenant/students/{registered_id}",
        json={"class_id": class_id},
        headers=headers,
    )
    await _complete_registration(client, headers, registered_id)

    pending_id = await _create_student(client, headers)
    await client.patch(
        f"/api/v1/tenant/students/{pending_id}",
        json={"class_id": class_id},
        headers=headers,
    )
    await client.post(
        "/api/v1/tenant/registration",
        json={"student_id": pending_id},
        headers=headers,
    )

    summary = await client.get("/api/v1/tenant/registration/roster-summary", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()["total_registered"] == 1
    assert summary.json()["total_enrolled"] == 2

    roster = await client.get(
        f"/api/v1/tenant/registration/roster?class_id={class_id}",
        headers=headers,
    )
    assert roster.status_code == 200, roster.text
    body = roster.json()
    assert len(body) == 1
    assert body[0]["student_id"] == registered_id
    assert body[0]["registration_id"] is not None

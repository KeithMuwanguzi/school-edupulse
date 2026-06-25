"""Report cards module — preview and class listing."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

pytestmark = pytest.mark.asyncio


async def _create_class(client, headers, label: str = "P5 East") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P5", "label": label},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_subject(client, headers, code: str = "ENG") -> str:
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": code, "name": "English", "ncdc_cycle": "cycle_3"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _enroll_and_register(client, headers, class_id: str) -> str:
    created = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            last_name="Okello",
            first_name="James",
        ),
        headers=headers,
    )
    assert created.status_code == 201, created.text
    student_id = created.json()["id"]

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
    return student_id


async def test_report_card_preview(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "RC001",
        module_keys=["core", "students", "academics", "reportcards"],
    )
    await _create_subject(client, headers)
    class_id = await _create_class(client, headers)
    student_id = await _enroll_and_register(client, headers, class_id)

    classes = await client.get("/api/v1/tenant/reportcards/classes", headers=headers)
    assert classes.status_code == 200
    assert any(c["class_id"] == class_id and c["registered_count"] == 1 for c in classes.json())

    students = await client.get(
        f"/api/v1/tenant/reportcards/students?class_id={class_id}",
        headers=headers,
    )
    assert students.status_code == 200
    assert len(students.json()) == 1

    preview = await client.get(
        f"/api/v1/tenant/reportcards/preview?student_id={student_id}",
        headers=headers,
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["assessment_mode"] == "subject_ca"
    assert body["marks_available"] is False
    assert len(body["subject_lines"]) >= 1
    assert body["school"]["name"]
    assert body["level_section"] == "Upper Primary"
    assert "assessment_sets" in body
    assert "grading_key" in body
    for line in body["subject_lines"]:
        assert "set_scores" in line
        assert "is_core" in line


async def test_report_card_preview_pending_grading_comments(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "RC003",
        module_keys=["core", "students", "academics", "reportcards"],
    )
    await _create_subject(client, headers)
    scale = await client.post(
        "/api/v1/tenant/grading/scales",
        json={"name": "Standard PLE", "ncdc_cycle": "cycle_3"},
        headers=headers,
    )
    assert scale.status_code == 201, scale.text
    class_id = await _create_class(client, headers)
    student_id = await _enroll_and_register(client, headers, class_id)

    preview = await client.get(
        f"/api/v1/tenant/reportcards/preview?student_id={student_id}",
        headers=headers,
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["comments_status"] == "pending_marks"
    assert body["class_teacher_comment"] is None
    assert body["head_teacher_comment"] is None


async def test_report_cards_module_gate(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "RC002", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/reportcards/classes", headers=headers)
    assert resp.status_code == 403

"""Phase 2 §9 — assessment sets, CA config, teacher mark entry."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

pytestmark = pytest.mark.asyncio

MODULES = ["core", "students", "teachers", "academics", "assessment"]


async def _headers(client, admin_headers, code: str):
    headers, onboard = await onboard_and_login(
        client, admin_headers, code, module_keys=MODULES
    )
    return headers, onboard


async def _create_class(client, headers, level: str = "P5") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes", json={"level": level}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_subject(client, headers, code: str = "ENG", cycle: str = "cycle_3") -> str:
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": code, "name": "English", "ncdc_cycle": cycle},
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def _enroll(client, headers, class_id: str) -> str:
    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, first_name="Mark", last_name="Student"),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


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
    if responses:
        upd = await client.put(
            f"/api/v1/tenant/registration/{detail['id']}/responses",
            json={"responses": responses},
            headers=headers,
        )
        assert upd.status_code == 200, upd.text


async def _create_teacher(client, headers, onboard, login_id: str = "0099"):
    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": login_id,
            "name": "Subject Teacher",
            "role_key": "teacher",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    teacher_id = resp.json()["id"]
    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"{login_id}@{onboard['school_code']}", "password": "TempPass!2025"},
    )
    assert login.status_code == 200, login.text
    return teacher_id, {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _term_id(client, headers) -> str:
    ctx = await client.get("/api/v1/tenant/academic-context", headers=headers)
    assert ctx.status_code == 200, ctx.text
    return ctx.json()["active_term"]["id"]


async def test_module_gate_blocks_without_assessment(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "ASM0", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/assessment/summary", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["module"] == "assessment"


async def test_admin_configures_sets_and_ca(client, admin_headers):
    headers, _ = await _headers(client, admin_headers, "ASM1")
    term_id = await _term_id(client, headers)

    created = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "CAT 1", "max_mark": 100},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    set_id = created.json()["id"]
    assert created.json()["entry_status"] == "draft"

    opened = await client.post(
        f"/api/v1/tenant/assessment/sets/{set_id}/open", headers=headers
    )
    assert opened.status_code == 200
    assert opened.json()["entry_status"] == "open"

    cat2 = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "CAT 2", "max_mark": 50},
        headers=headers,
    )
    set2_id = cat2.json()["id"]

    ca = await client.put(
        f"/api/v1/tenant/assessment/ca-config?term_id={term_id}",
        json={
            "method": "average",
            "inclusions": [
                {"set_id": set_id, "weight": 1.0, "sort_order": 0},
                {"set_id": set2_id, "weight": 1.0, "sort_order": 1},
            ],
        },
        headers=headers,
    )
    assert ca.status_code == 200, ca.text
    assert len(ca.json()["inclusions"]) == 2

    summary = await client.get("/api/v1/tenant/assessment/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["total_sets"] == 2
    assert summary.json()["ca_configured"] is True


async def test_teacher_enters_marks_and_ca_computed(client, admin_headers):
    headers, onboard = await _headers(client, admin_headers, "ASM2")
    term_id = await _term_id(client, headers)
    class_id = await _create_class(client, headers, "P5")
    subject_id = await _create_subject(client, headers)
    student_id = await _enroll(client, headers, class_id)
    await _complete_registration(client, headers, student_id)

    teacher_id, t_headers = await _create_teacher(client, headers, onboard)
    assign = await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "term_id": term_id,
        },
        headers=headers,
    )
    assert assign.status_code == 201, assign.text

    set_resp = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "Mid Term", "max_mark": 100},
        headers=headers,
    )
    set_id = set_resp.json()["id"]
    await client.post(f"/api/v1/tenant/assessment/sets/{set_id}/open", headers=headers)
    await client.put(
        f"/api/v1/tenant/assessment/ca-config?term_id={term_id}",
        json={"method": "average", "inclusions": [{"set_id": set_id, "weight": 1.0}]},
        headers=headers,
    )

    roster = await client.get(
        f"/api/v1/tenant/assessment/entry/roster?set_id={set_id}&class_id={class_id}&subject_id={subject_id}",
        headers=t_headers,
    )
    assert roster.status_code == 200, roster.text
    assert roster.json()["can_edit"] is True
    assert len(roster.json()["students"]) == 1

    saved = await client.put(
        "/api/v1/tenant/assessment/entry/marks",
        json={
            "set_id": set_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "marks": [{"student_id": student_id, "score": 80}],
        },
        headers=t_headers,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["saved"] == 1

    blocked = await client.put(
        "/api/v1/tenant/assessment/entry/marks",
        json={
            "set_id": set_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "marks": [{"student_id": student_id, "score": 70}],
        },
        headers=headers,
    )
    assert blocked.status_code == 403

    ca = await client.get(
        f"/api/v1/tenant/assessment/computed-ca?class_id={class_id}",
        headers=headers,
    )
    assert ca.status_code == 200, ca.text
    student_row = ca.json()["students"][0]
    assert student_row["subjects"][0]["ca_score"] == 80.0


async def test_closed_set_blocks_teacher_entry(client, admin_headers):
    headers, onboard = await _headers(client, admin_headers, "ASM3")
    term_id = await _term_id(client, headers)
    class_id = await _create_class(client, headers)
    subject_id = await _create_subject(client, headers)
    student_id = await _enroll(client, headers, class_id)
    await _complete_registration(client, headers, student_id)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard, "0101")
    await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "term_id": term_id,
        },
        headers=headers,
    )
    set_resp = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "Closed Test"},
        headers=headers,
    )
    set_id = set_resp.json()["id"]

    fail = await client.put(
        "/api/v1/tenant/assessment/entry/marks",
        json={
            "set_id": set_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "marks": [{"student_id": student_id, "score": 50}],
        },
        headers=t_headers,
    )
    assert fail.status_code == 422


async def test_p4_uses_numeric_mark_entry(client, admin_headers):
    headers, onboard = await _headers(client, admin_headers, "ASM4")
    term_id = await _term_id(client, headers)
    class_id = await _create_class(client, headers, "P4")
    subject_id = await _create_subject(client, headers, code="MATH", cycle="cycle_2")
    student_id = await _enroll(client, headers, class_id)
    await _complete_registration(client, headers, student_id)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard, "0102")
    await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "term_id": term_id,
        },
        headers=headers,
    )
    set_resp = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "BOT1", "max_mark": 100},
        headers=headers,
    )
    set_id = set_resp.json()["id"]
    await client.post(f"/api/v1/tenant/assessment/sets/{set_id}/open", headers=headers)

    roster = await client.get(
        f"/api/v1/tenant/assessment/entry/roster?set_id={set_id}&class_id={class_id}&subject_id={subject_id}",
        headers=t_headers,
    )
    assert roster.status_code == 200, roster.text
    assert roster.json()["scoring_mode"] == "numeric"
    assert roster.json()["max_mark"] == 100

    saved = await client.put(
        "/api/v1/tenant/assessment/entry/marks",
        json={
            "set_id": set_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "marks": [{"student_id": student_id, "score": 78}],
        },
        headers=t_headers,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["saved"] == 1


async def test_ca_fallback_without_config(client, admin_headers):
    """CA overview averages recorded sets when admin has not saved CA inclusions."""
    headers, onboard = await _headers(client, admin_headers, "ASM5")
    term_id = await _term_id(client, headers)
    class_id = await _create_class(client, headers, "P5")
    subject_id = await _create_subject(client, headers)
    student_id = await _enroll(client, headers, class_id)
    await _complete_registration(client, headers, student_id)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard, "0103")
    await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "term_id": term_id,
        },
        headers=headers,
    )
    set_resp = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "Quick Test", "max_mark": 100},
        headers=headers,
    )
    set_id = set_resp.json()["id"]
    await client.post(f"/api/v1/tenant/assessment/sets/{set_id}/open", headers=headers)
    await client.put(
        "/api/v1/tenant/assessment/entry/marks",
        json={
            "set_id": set_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "marks": [{"student_id": student_id, "score": 65}],
        },
        headers=t_headers,
    )

    ca = await client.get(
        f"/api/v1/tenant/assessment/computed-ca?class_id={class_id}",
        headers=headers,
    )
    assert ca.status_code == 200, ca.text
    body = ca.json()
    assert body["ca_configured"] is False
    assert body["using_all_recorded_sets"] is True
    assert body["students"][0]["subjects"][0]["ca_score"] == 65.0


async def test_lower_primary_uses_numeric_marks(client, admin_headers):
    """P1 records numeric marks too (schools use percentages/aggregates)."""
    headers, onboard = await _headers(client, admin_headers, "ASM6")
    term_id = await _term_id(client, headers)
    class_id = await _create_class(client, headers, "P1")
    subject_id = await _create_subject(client, headers, code="LIT", cycle="cycle_1")
    student_id = await _enroll(client, headers, class_id)
    await _complete_registration(client, headers, student_id)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard, "0104")
    await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "term_id": term_id,
        },
        headers=headers,
    )
    set_resp = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "Formative 1", "max_mark": 100},
        headers=headers,
    )
    set_id = set_resp.json()["id"]
    await client.post(f"/api/v1/tenant/assessment/sets/{set_id}/open", headers=headers)

    roster = await client.get(
        f"/api/v1/tenant/assessment/entry/roster?set_id={set_id}&class_id={class_id}&subject_id={subject_id}",
        headers=t_headers,
    )
    assert roster.status_code == 200, roster.text
    assert roster.json()["scoring_mode"] == "numeric"

    await client.put(
        "/api/v1/tenant/assessment/entry/marks",
        json={
            "set_id": set_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "marks": [{"student_id": student_id, "score": 72}],
        },
        headers=t_headers,
    )

    grid = await client.get(
        f"/api/v1/tenant/assessment/marks-grid?set_id={set_id}&class_id={class_id}",
        headers=headers,
    )
    assert grid.status_code == 200, grid.text
    data = grid.json()
    assert data["scoring_mode"] == "numeric"
    assert data["students"][0]["cells"][0]["display"] == "72/100"


async def test_marks_import_skips_unregistered(client, admin_headers):
    headers, onboard = await _headers(client, admin_headers, "ASM7")
    term_id = await _term_id(client, headers)
    class_id = await _create_class(client, headers, "P5")
    subject_id = await _create_subject(client, headers)
    registered_id = await _enroll(client, headers, class_id)
    await _complete_registration(client, headers, registered_id)
    # A second pupil who is enrolled but NOT term-registered.
    unregistered = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, first_name="Nora", last_name="Pending"),
        headers=headers,
    )
    assert unregistered.status_code == 201, unregistered.text

    teacher_id, t_headers = await _create_teacher(client, headers, onboard, "0105")
    await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
            "term_id": term_id,
        },
        headers=headers,
    )
    set_resp = await client.post(
        "/api/v1/tenant/assessment/sets",
        json={"term_id": term_id, "name": "EOT", "max_mark": 100},
        headers=headers,
    )
    set_id = set_resp.json()["id"]
    await client.post(f"/api/v1/tenant/assessment/sets/{set_id}/open", headers=headers)

    body = {
        "set_id": set_id,
        "class_id": class_id,
        "subject_id": subject_id,
        "rows": [
            {"first_name": "Mark", "last_name": "Student", "score": 88},
            {"first_name": "Nora", "last_name": "Pending", "score": 70},
            {"first_name": "Ghost", "last_name": "Pupil", "score": 50},
        ],
    }

    dry = await client.put(
        "/api/v1/tenant/assessment/entry/import",
        json={**body, "dry_run": True},
        headers=t_headers,
    )
    assert dry.status_code == 200, dry.text
    assert dry.json()["valid"] == 1
    assert dry.json()["skipped"] == 2
    assert dry.json()["imported"] == 0

    commit = await client.put(
        "/api/v1/tenant/assessment/entry/import",
        json=body,
        headers=t_headers,
    )
    assert commit.status_code == 200, commit.text
    assert commit.json()["imported"] == 1
    assert commit.json()["skipped"] == 2

"""Phase 2 §7 — daily attendance, now driven by the timetable + teacher clock."""
from __future__ import annotations

import datetime as dt

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

pytestmark = pytest.mark.asyncio

MODULES = ["core", "students", "teachers", "academics", "attendance", "timetable"]


async def _onboard(client, admin_headers, code: str):
    return await onboard_and_login(client, admin_headers, code, module_keys=MODULES)


async def _create_class(client, headers, level: str = "P3") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes", json={"level": level}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_subject(client, headers, code: str = "ENG", cycle: str = "cycle_1") -> str:
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": code, "name": code.title(), "ncdc_cycle": cycle},
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def _enroll_student(client, headers, class_id: str) -> str:
    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            first_name="Roll",
            last_name="Student",
        ),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _complete_term_registration(client, headers, student_id: str) -> None:
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
    if not responses:
        return
    upd = await client.put(
        f"/api/v1/tenant/registration/{detail['id']}/responses",
        json={"responses": responses},
        headers=headers,
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["status"] == "complete"


async def _create_teacher(client, headers, onboard, login_id: str = "0002"):
    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": login_id,
            "name": "Class Teacher",
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


async def _create_slot(
    client, headers, *, teacher_id, class_id, subject_id, starts: str, ends: str
) -> str:
    resp = await client.post(
        "/api/v1/tenant/timetable/slots",
        json={
            "day_of_week": dt.date.today().isoweekday(),
            "starts_at": starts,
            "ends_at": ends,
            "class_id": class_id,
            "subject_id": subject_id,
            "teacher_user_id": teacher_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_module_gate_blocks_without_attendance(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "ATT1", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/attendance/summary", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["module"] == "attendance"


async def test_roll_defaults_to_present(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "ATT2")
    class_id = await _create_class(client, headers)
    student_id = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, student_id)

    today = dt.date.today().isoformat()
    roll = await client.get(
        f"/api/v1/tenant/attendance/roll?class_id={class_id}&date={today}",
        headers=headers,
    )
    assert roll.status_code == 200, roll.text
    body = roll.json()
    assert len(body["rows"]) == 1
    assert body["rows"][0]["status"] == "present"
    assert body["rows"][0]["saved"] is False


async def test_unregistered_student_not_on_roll(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "ATT2B")
    class_id = await _create_class(client, headers)
    await _enroll_student(client, headers, class_id)

    today = dt.date.today().isoformat()
    roll = await client.get(
        f"/api/v1/tenant/attendance/roll?class_id={class_id}&date={today}",
        headers=headers,
    )
    assert roll.status_code == 200, roll.text
    assert roll.json()["rows"] == []


async def test_admin_cannot_mark(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "ATT3")
    class_id = await _create_class(client, headers)
    s1 = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, s1)

    resp = await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "date": dt.date.today().isoformat(),
            "records": [{"student_id": s1, "status": "present"}],
        },
        headers=headers,
    )
    # Admins lack the teacher role on the mark endpoint.
    assert resp.status_code == 403


async def test_teacher_marks_after_lesson_ends(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "ATT4")
    class_id = await _create_class(client, headers, "P3")
    subject_id = await _create_subject(client, headers, "ENG", "cycle_1")
    s1 = await _enroll_student(client, headers, class_id)
    s2 = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, s1)
    await _complete_term_registration(client, headers, s2)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard)
    # Lesson that has already ended today.
    slot_id = await _create_slot(
        client,
        headers,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=subject_id,
        starts="00:00:00",
        ends="00:00:05",
    )

    today = dt.date.today().isoformat()
    marked = await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "timetable_slot_id": slot_id,
            "date": today,
            "records": [
                {"student_id": s1, "status": "present"},
                {"student_id": s2, "status": "absent", "remarks": "Sick"},
            ],
        },
        headers=t_headers,
    )
    assert marked.status_code == 200, marked.text
    assert marked.json()["saved"] == 2
    assert marked.json()["absent"] == 1


async def test_teacher_cannot_mark_before_lesson_ends(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "ATT5")
    class_id = await _create_class(client, headers, "P3")
    subject_id = await _create_subject(client, headers, "ENG", "cycle_1")
    s1 = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, s1)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard)
    # Lesson that has not ended yet today.
    await _create_slot(
        client,
        headers,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=subject_id,
        starts="23:58:00",
        ends="23:59:00",
    )

    resp = await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "date": dt.date.today().isoformat(),
            "records": [{"student_id": s1, "status": "present"}],
        },
        headers=t_headers,
    )
    assert resp.status_code == 403
    assert "ended" in resp.json()["detail"].lower()


async def test_teacher_cannot_mark_unscheduled_class(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "ATT6")
    class_id = await _create_class(client, headers)
    student_id = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, student_id)
    _, t_headers = await _create_teacher(client, headers, onboard)

    resp = await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "records": [{"student_id": student_id, "status": "present"}],
        },
        headers=t_headers,
    )
    assert resp.status_code == 403
    assert "lesson" in resp.json()["detail"].lower()


async def test_daily_summary_counts(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "ATT7")
    class_id = await _create_class(client, headers, "P3")
    subject_id = await _create_subject(client, headers, "ENG", "cycle_1")
    s1 = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, s1)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard)
    slot_id = await _create_slot(
        client,
        headers,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=subject_id,
        starts="00:00:00",
        ends="00:00:05",
    )

    today = dt.date.today().isoformat()
    await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "timetable_slot_id": slot_id,
            "date": today,
            "records": [{"student_id": s1, "status": "late"}],
        },
        headers=t_headers,
    )

    summary = await client.get(
        f"/api/v1/tenant/attendance/summary?date={today}", headers=headers
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["late"] == 1
    assert body["total_marked"] == 1
    cls = next(c for c in body["classes"] if c["class_id"] == class_id)
    assert cls["marked"] == 1


async def test_each_lesson_has_separate_attendance(client, admin_headers):
    """Marking period 1 must not overwrite period 2 for the same class."""
    headers, onboard = await _onboard(client, admin_headers, "ATT8")
    class_id = await _create_class(client, headers, "P3")
    eng_id = await _create_subject(client, headers, "ENG", "cycle_1")
    math_id = await _create_subject(client, headers, "MTC", "cycle_1")
    student_id = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, student_id)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard)

    slot1 = await _create_slot(
        client,
        headers,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=eng_id,
        starts="00:00:00",
        ends="00:00:05",
    )
    slot2 = await _create_slot(
        client,
        headers,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=math_id,
        starts="00:00:10",
        ends="00:00:15",
    )

    today = dt.date.today().isoformat()
    await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "timetable_slot_id": slot1,
            "date": today,
            "records": [{"student_id": student_id, "status": "present"}],
        },
        headers=t_headers,
    )

    roll2_before = await client.get(
        f"/api/v1/tenant/attendance/roll?class_id={class_id}&date={today}&timetable_slot_id={slot2}",
        headers=headers,
    )
    assert roll2_before.status_code == 200, roll2_before.text
    assert roll2_before.json()["rows"][0]["status"] == "present"
    assert roll2_before.json()["rows"][0]["saved"] is False

    await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "timetable_slot_id": slot2,
            "date": today,
            "records": [{"student_id": student_id, "status": "absent"}],
        },
        headers=t_headers,
    )

    roll1_after = await client.get(
        f"/api/v1/tenant/attendance/roll?class_id={class_id}&date={today}&timetable_slot_id={slot1}",
        headers=headers,
    )
    roll2_after = await client.get(
        f"/api/v1/tenant/attendance/roll?class_id={class_id}&date={today}&timetable_slot_id={slot2}",
        headers=headers,
    )
    assert roll1_after.json()["rows"][0]["status"] == "present"
    assert roll2_after.json()["rows"][0]["status"] == "absent"


async def test_class_day_lists_lessons_with_counts(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "ATT9")
    class_id = await _create_class(client, headers, "P3")
    eng_id = await _create_subject(client, headers, "ENG", "cycle_1")
    math_id = await _create_subject(client, headers, "MTC", "cycle_1")
    student_id = await _enroll_student(client, headers, class_id)
    await _complete_term_registration(client, headers, student_id)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard)

    slot1 = await _create_slot(
        client,
        headers,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=eng_id,
        starts="00:00:00",
        ends="00:00:05",
    )
    await _create_slot(
        client,
        headers,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=math_id,
        starts="00:00:10",
        ends="00:00:15",
    )

    today = dt.date.today().isoformat()
    await client.post(
        "/api/v1/tenant/attendance/mark",
        json={
            "class_id": class_id,
            "timetable_slot_id": slot1,
            "date": today,
            "records": [{"student_id": student_id, "status": "absent", "remarks": "Sick"}],
        },
        headers=t_headers,
    )

    day = await client.get(
        f"/api/v1/tenant/attendance/class-day?class_id={class_id}&date={today}",
        headers=headers,
    )
    assert day.status_code == 200, day.text
    body = day.json()
    assert body["class_id"] == class_id
    assert len(body["lessons"]) == 2
    eng = next(l for l in body["lessons"] if l["slot_id"] == slot1)
    math = next(l for l in body["lessons"] if l["slot_id"] != slot1)
    assert eng["recorded"] is True
    assert eng["absent"] == 1
    assert math["recorded"] is False

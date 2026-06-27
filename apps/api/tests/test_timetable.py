"""Timetable — weekly lesson slots, conflicts, and the teacher day view."""
from __future__ import annotations

import datetime as dt

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio

MODULES = ["core", "students", "teachers", "academics", "attendance", "timetable"]


async def _onboard(client, admin_headers, code: str):
    return await onboard_and_login(client, admin_headers, code, module_keys=MODULES)


async def _create_class(client, headers, level: str = "P3") -> str:
    resp = await client.post("/api/v1/tenant/classes", json={"level": level}, headers=headers)
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


async def _create_teacher(client, headers, onboard, login_id: str = "0002"):
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
    teacher_id = resp.json()["id"]
    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"{login_id}@{onboard['school_code']}", "password": "TempPass!2025"},
    )
    assert login.status_code == 200, login.text
    return teacher_id, {"Authorization": f"Bearer {login.json()['access_token']}"}


def _slot_body(*, teacher_id, class_id, subject_id, day=None, starts="08:00", ends="08:40"):
    return {
        "day_of_week": day or dt.date.today().isoweekday(),
        "starts_at": starts,
        "ends_at": ends,
        "class_id": class_id,
        "subject_id": subject_id,
        "teacher_user_id": teacher_id,
    }


async def test_module_gate_blocks_without_timetable(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "TTBL1", module_keys=["core", "academics"]
    )
    resp = await client.get("/api/v1/tenant/timetable/slots", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["module"] == "timetable"


async def test_create_and_list_slot(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "TTBL2")
    class_id = await _create_class(client, headers)
    subject_id = await _create_subject(client, headers)
    teacher_id, _ = await _create_teacher(client, headers, onboard)

    created = await client.post(
        "/api/v1/tenant/timetable/slots",
        json=_slot_body(teacher_id=teacher_id, class_id=class_id, subject_id=subject_id),
        headers=headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["subject_code"] == "ENG"
    assert body["teacher_name"] == "Grace Namuli"

    listed = await client.get("/api/v1/tenant/timetable/slots", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_invalid_times_rejected(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "TTBL3")
    class_id = await _create_class(client, headers)
    subject_id = await _create_subject(client, headers)
    teacher_id, _ = await _create_teacher(client, headers, onboard)

    resp = await client.post(
        "/api/v1/tenant/timetable/slots",
        json=_slot_body(
            teacher_id=teacher_id, class_id=class_id, subject_id=subject_id,
            starts="10:00", ends="09:00",
        ),
        headers=headers,
    )
    assert resp.status_code == 422


async def test_teacher_conflict_rejected(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "TTBL4")
    class_a = await _create_class(client, headers, "P3")
    class_b = await _create_class(client, headers, "P4")
    subject_id = await _create_subject(client, headers)
    teacher_id, _ = await _create_teacher(client, headers, onboard)

    first = await client.post(
        "/api/v1/tenant/timetable/slots",
        json=_slot_body(
            teacher_id=teacher_id, class_id=class_a, subject_id=subject_id,
            starts="08:00", ends="09:00",
        ),
        headers=headers,
    )
    assert first.status_code == 201
    clash = await client.post(
        "/api/v1/tenant/timetable/slots",
        json=_slot_body(
            teacher_id=teacher_id, class_id=class_b, subject_id=subject_id,
            starts="08:30", ends="09:30",
        ),
        headers=headers,
    )
    assert clash.status_code == 409


async def test_teacher_cannot_build_timetable(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "TTBL5")
    class_id = await _create_class(client, headers)
    subject_id = await _create_subject(client, headers)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard)

    resp = await client.post(
        "/api/v1/tenant/timetable/slots",
        json=_slot_body(teacher_id=teacher_id, class_id=class_id, subject_id=subject_id),
        headers=t_headers,
    )
    assert resp.status_code == 403


async def test_import_slots(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "TTBL7")
    await _create_class(client, headers, "P3")
    await _create_subject(client, headers, "ENG", "cycle_1")
    await _create_teacher(client, headers, onboard)

    rows = [
        {
            "day": "Monday",
            "starts_at": "08:00",
            "ends_at": "08:40",
            "class_level": "P3",
            "subject_code": "ENG",
            "teacher": "Grace Namuli",
        },
        {
            "day": "Monday",
            "starts_at": "08:20",
            "ends_at": "09:00",
            "class_level": "P3",
            "subject_code": "ENG",
            "teacher": "0002",
        },  # overlaps the first row for the same teacher
        {
            "day": "Tuesday",
            "starts_at": "08:00",
            "ends_at": "08:40",
            "class_level": "P9",
            "subject_code": "ENG",
            "teacher": "0002",
        },  # unknown class
    ]

    dry = await client.post(
        "/api/v1/tenant/timetable/import",
        json={"rows": rows, "dry_run": True},
        headers=headers,
    )
    assert dry.status_code == 200, dry.text
    body = dry.json()
    assert body["valid"] == 1
    assert body["failed"] == 2
    # Nothing persisted on a dry run.
    listed = await client.get("/api/v1/tenant/timetable/slots", headers=headers)
    assert listed.json() == []

    committed = await client.post(
        "/api/v1/tenant/timetable/import",
        json={"rows": rows, "dry_run": False},
        headers=headers,
    )
    assert committed.status_code == 200, committed.text
    assert committed.json()["created"] == 1
    listed2 = await client.get("/api/v1/tenant/timetable/slots", headers=headers)
    assert len(listed2.json()) == 1


async def test_teacher_my_day(client, admin_headers):
    headers, onboard = await _onboard(client, admin_headers, "TTBL6")
    class_id = await _create_class(client, headers)
    subject_id = await _create_subject(client, headers)
    teacher_id, t_headers = await _create_teacher(client, headers, onboard)
    await client.post(
        "/api/v1/tenant/timetable/slots",
        json=_slot_body(
            teacher_id=teacher_id, class_id=class_id, subject_id=subject_id,
            starts="00:00:00", ends="00:00:05",
        ),
        headers=headers,
    )

    today = dt.date.today().isoformat()
    resp = await client.get(f"/api/v1/tenant/timetable/my-day?date={today}", headers=t_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["lessons"]) == 1
    lesson = body["lessons"][0]
    assert lesson["has_ended"] is True
    assert lesson["can_record"] is True
    assert lesson["recorded"] is False

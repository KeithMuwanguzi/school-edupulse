"""Phase 2 §5 — rich student profile: guardians, health, discipline."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload, import_row_payload

pytestmark = pytest.mark.asyncio


async def _headers(client, admin_headers, code: str):
    headers, _ = await onboard_and_login(
        client, admin_headers, code, module_keys=["core", "students", "academics"]
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
        json=enrollment_payload(class_id=class_id),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_onboarding_with_embedded_guardians_and_health(client, admin_headers):
    headers = await _headers(client, admin_headers, "SPRF1")
    class_id = await _ensure_class(client, headers)
    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            first_name="Onboard",
            last_name="Wizard",
            nationality="Ugandan",
            residence="boarder",
            guardians=[
                {
                    "relationship": "mother",
                    "full_name": "Sarah Nakimera",
                    "phone_primary": "+256700111222",
                    "is_primary": True,
                },
                {
                    "relationship": "father",
                    "full_name": "Paul Mukasa",
                    "phone_primary": "+256700111223",
                    "is_primary": False,
                },
            ],
            health={"blood_group": "O+", "allergies": "Peanuts"},
        ),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    sid = resp.json()["id"]
    assert resp.json()["residence"] == "boarder"
    assert resp.json()["guardian_count"] == 2

    detail = await client.get(f"/api/v1/tenant/students/{sid}/detail", headers=headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert len(body["guardians"]) == 2
    assert body["guardians"][0]["is_primary"] is True  # primary sorted first
    assert body["health"]["blood_group"] == "O+"
    assert body["nationality"] == "Ugandan"


async def test_guardian_crud(client, admin_headers):
    headers = await _headers(client, admin_headers, "SPRF2")
    sid = await _create_student(client, headers)

    add = await client.post(
        f"/api/v1/tenant/students/{sid}/guardians",
        json={"relationship": "guardian", "full_name": "Aunt Joy", "is_primary": True},
        headers=headers,
    )
    assert add.status_code == 201, add.text
    gid = add.json()["id"]

    # Adding a second primary should demote the first.
    add2 = await client.post(
        f"/api/v1/tenant/students/{sid}/guardians",
        json={"relationship": "mother", "full_name": "Mama Real", "is_primary": True},
        headers=headers,
    )
    assert add2.status_code == 201

    listed = await client.get(f"/api/v1/tenant/students/{sid}/guardians", headers=headers)
    primaries = [g for g in listed.json() if g["is_primary"]]
    assert len(primaries) == 1
    assert primaries[0]["full_name"] == "Mama Real"

    upd = await client.patch(
        f"/api/v1/tenant/students/guardians/{gid}",
        json={"phone_primary": "+256780000000", "occupation": "Trader"},
        headers=headers,
    )
    assert upd.status_code == 200
    assert upd.json()["occupation"] == "Trader"

    rm = await client.delete(
        f"/api/v1/tenant/students/guardians/{gid}", headers=headers
    )
    assert rm.status_code == 204
    after = await client.get(f"/api/v1/tenant/students/{sid}/guardians", headers=headers)
    assert len(after.json()) == 2


async def test_health_upsert(client, admin_headers):
    headers = await _headers(client, admin_headers, "SPRF3")
    sid = await _create_student(client, headers)

    existing = await client.get(f"/api/v1/tenant/students/{sid}/health", headers=headers)
    assert existing.status_code == 200
    assert existing.json()["blood_group"] == "O+"

    created = await client.put(
        f"/api/v1/tenant/students/{sid}/health",
        json={"blood_group": "A-", "chronic_conditions": "Asthma"},
        headers=headers,
    )
    assert created.status_code == 200, created.text
    assert created.json()["blood_group"] == "A-"

    updated = await client.put(
        f"/api/v1/tenant/students/{sid}/health",
        json={"blood_group": "A+", "chronic_conditions": "Asthma", "doctor_name": "Dr. Ssali"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["blood_group"] == "A+"
    assert updated.json()["doctor_name"] == "Dr. Ssali"


async def test_discipline_crud_and_school_wide(client, admin_headers):
    headers = await _headers(client, admin_headers, "SPRF4")
    sid = await _create_student(client, headers)

    add = await client.post(
        f"/api/v1/tenant/students/{sid}/discipline",
        json={
            "incident_date": "2026-02-10",
            "category": "punctuality",
            "severity": "minor",
            "description": "Late to assembly.",
        },
        headers=headers,
    )
    assert add.status_code == 201, add.text
    rid = add.json()["id"]
    assert add.json()["status"] == "open"

    per_student = await client.get(
        f"/api/v1/tenant/students/{sid}/discipline", headers=headers
    )
    assert len(per_student.json()) == 1

    school_wide = await client.get("/api/v1/tenant/students/discipline", headers=headers)
    assert school_wide.status_code == 200
    assert len(school_wide.json()) == 1
    assert school_wide.json()[0]["student_number"] == add.json()["student_number"]

    upd = await client.patch(
        f"/api/v1/tenant/students/discipline/{rid}",
        json={"status": "resolved", "action_taken": "Counselled."},
        headers=headers,
    )
    assert upd.status_code == 200
    assert upd.json()["status"] == "resolved"

    open_only = await client.get(
        "/api/v1/tenant/students/discipline?status=open", headers=headers
    )
    assert open_only.json() == []

    rm = await client.delete(
        f"/api/v1/tenant/students/discipline/{rid}", headers=headers
    )
    assert rm.status_code == 204


async def test_import_with_guardian_and_health(client, admin_headers):
    headers = await _headers(client, admin_headers, "SPRF5")
    await _ensure_class(client, headers)
    resp = await client.post(
        "/api/v1/tenant/students/import",
        json={
            "rows": [
                import_row_payload(
                    first_name="Imported",
                    last_name="Profile",
                    guardian_name="Grace Mother",
                    guardian_relationship="mother",
                    guardian_phone="+256700999888",
                    blood_group="B+",
                    allergies="Dust",
                ),
            ],
            "dry_run": False,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created"] == 1

    listed = await client.get("/api/v1/tenant/students", headers=headers)
    sid = listed.json()["items"][0]["id"]
    detail = await client.get(f"/api/v1/tenant/students/{sid}/detail", headers=headers)
    body = detail.json()
    assert body["nationality"] == "Ugandan"
    assert len(body["guardians"]) == 1
    assert body["guardians"][0]["full_name"] == "Grace Mother"
    assert body["health"]["blood_group"] == "B+"


async def test_non_admin_cannot_modify_profile(client, admin_headers, db):
    """Teachers (non-admin) may read assigned students but not write profile sub-resources."""
    from sqlalchemy import select

    from app.core.db import apply_bypass_guc
    from app.core.security import hash_password
    from app.models.enums import UserStatus
    from app.models.user import Role, TenantUser

    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "SPRF6",
        module_keys=["core", "students", "academics", "teachers"],
    )
    class_id = await _create_class(client, headers)
    subject = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "ENG", "name": "English", "ncdc_cycle": "cycle_1"},
        headers=headers,
    )
    assert subject.status_code in (200, 201), subject.text
    subject_id = subject.json()["id"]

    enrolled = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id),
        headers=headers,
    )
    assert enrolled.status_code == 201, enrolled.text
    sid = enrolled.json()["id"]

    # Create a teacher and log in.
    from uuid import UUID

    tenant_id = UUID(onboard["tenant_id"])
    await apply_bypass_guc(db)
    role = await db.scalar(select(Role).where(Role.role_key == "teacher"))
    teacher = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id="0050",
        password_hash=hash_password("TempPass!2025"),
        name="Read Only",
        status=UserStatus.active,
    )
    db.add(teacher)
    await db.commit()

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={
            "username": f"0050@{onboard['school_code']}",
            "password": "TempPass!2025",
        },
    )
    assert login.status_code == 200, login.text
    t_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Without an assignment, teachers cannot open the student profile.
    blocked = await client.get(f"/api/v1/tenant/students/{sid}/detail", headers=t_headers)
    assert blocked.status_code == 403

    teacher_id = (
        await client.get("/api/v1/tenant/teachers/staff", headers=headers)
    ).json()[0]["id"]
    assigned = await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
        },
        headers=headers,
    )
    assert assigned.status_code == 201, assigned.text

    # Can read detail once assigned to the student's class.
    assert (
        await client.get(f"/api/v1/tenant/students/{sid}/detail", headers=t_headers)
    ).status_code == 200
    # Cannot add a guardian
    blocked = await client.post(
        f"/api/v1/tenant/students/{sid}/guardians",
        json={"relationship": "mother", "full_name": "Nope"},
        headers=t_headers,
    )
    assert blocked.status_code == 403

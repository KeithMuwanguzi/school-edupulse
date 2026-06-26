"""Phase 2 §5 — student enrollment."""
from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import select

from app.core.db import apply_bypass_guc, apply_tenant_guc
from app.core.security import hash_password
from app.models.enums import UserStatus
from app.models.student import Student
from app.models.user import Role, TenantUser
from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload, import_row_payload

pytestmark = pytest.mark.asyncio


async def _headers(client, admin_headers, code: str):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        code,
        module_keys=["core", "students", "teachers", "academics"],
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


async def _enroll(client, headers, class_id: str, **overrides):
    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, **overrides),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_list_students_empty(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU1")
    resp = await client.get("/api/v1/tenant/students", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["has_more"] is False


async def test_module_gate_blocks_without_students(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "STU2", module_keys=["core", "academics"]
    )
    resp = await client.get("/api/v1/tenant/students", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "MODULE_NOT_SUBSCRIBED"
    assert resp.json()["module"] == "students"


async def test_enroll_and_list_student(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU3")
    class_id = await _create_class(client, headers)

    body = await _enroll(
        client,
        headers,
        class_id,
        first_name="Kato",
        last_name="Okello",
    )
    # Number is auto-assigned: per-school prefix + 5-digit sequence.
    assert body["student_number"].isdigit()
    assert len(body["student_number"]) >= 6
    assert body["class_level"] == "P3"
    assert body["is_active"] is True

    listed = await client.get("/api/v1/tenant/students", headers=headers)
    assert len(listed.json()["items"]) == 1


async def test_auto_assigned_numbers_are_unique(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU4")
    class_id = await _create_class(client, headers)
    r1 = await _enroll(client, headers, class_id, first_name="Amina", last_name="Namuli")
    r2 = await _enroll(client, headers, class_id, first_name="Brenda", last_name="Akello")
    n1 = r1["student_number"]
    n2 = r2["student_number"]
    assert n1 != n2
    # Same school → same prefix (everything but the trailing 5-digit sequence).
    assert n1[:-5] == n2[:-5]
    assert int(n2[-5:]) == int(n1[-5:]) + 1


async def test_update_student_class(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU5")
    p3 = await _create_class(client, headers, "P3")
    p4 = await _create_class(client, headers, "P4")

    created = await _enroll(
        client,
        headers,
        p3,
        first_name="Peter",
        last_name="Ssemwanga",
    )
    student_id = created["id"]

    updated = await client.patch(
        f"/api/v1/tenant/students/{student_id}",
        json={"class_id": p4},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["class_level"] == "P4"


async def test_soft_delete_student(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU6")
    class_id = await _create_class(client, headers)
    created = await _enroll(
        client,
        headers,
        class_id,
        first_name="Mary",
        last_name="Nakato",
    )
    student_id = created["id"]
    assert (await client.delete(f"/api/v1/tenant/students/{student_id}", headers=headers)).status_code == 204

    listed = await client.get("/api/v1/tenant/students", headers=headers)
    assert listed.json()["items"] == []


async def test_rls_hides_other_tenant_students(client, admin_headers, db):
    headers_a, onboard_a = await onboard_and_login(
        client, admin_headers, "STU7A", module_keys=["core", "students", "academics"]
    )
    _, onboard_b = await onboard_and_login(
        client, admin_headers, "STU7B", module_keys=["core", "students", "academics"]
    )

    class_id = await _create_class(client, headers_a)
    await _enroll(client, headers_a, class_id, first_name="Jane", last_name="Doe")

    tenant_b = UUID(onboard_b["tenant_id"])
    await apply_tenant_guc(db, tenant_b)
    rows = await db.scalars(select(Student))
    assert list(rows) == []


async def test_guardian_link_on_student(client, admin_headers, db):
    headers, onboard = await onboard_and_login(
        client, admin_headers, "STU8", module_keys=["core", "students", "academics"]
    )
    tenant_id = UUID(onboard["tenant_id"])

    class_id = await _create_class(client, headers)
    created = await _enroll(client, headers, class_id, first_name="Child", last_name="One")
    number = created["student_number"]

    await apply_bypass_guc(db)
    role = await db.scalar(select(Role).where(Role.role_key == "parent"))
    parent = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id=number,
        password_hash=hash_password("ChangeMe!2025"),
        name="Guardian Parent",
        status=UserStatus.active,
    )
    db.add(parent)
    await db.commit()

    detail = await client.get("/api/v1/tenant/students", headers=headers)
    guardian = detail.json()["items"][0]["guardian"]
    assert guardian is not None
    assert guardian["name"] == "Guardian Parent"
    assert guardian["username"].startswith(f"{number}@")


async def test_list_students_filter_by_class_and_unassigned(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU9")
    p3 = await _create_class(client, headers, "P3")

    await _enroll(client, headers, p3, first_name="In", last_name="Class")
    unassigned_body = await _enroll(client, headers, p3, first_name="No", last_name="Class")
    await client.patch(
        f"/api/v1/tenant/students/{unassigned_body['id']}",
        json={"clear_class": True},
        headers=headers,
    )

    unassigned = await client.get(
        "/api/v1/tenant/students?unassigned=true",
        headers=headers,
    )
    assert unassigned.status_code == 200
    assert len(unassigned.json()["items"]) == 1
    assert unassigned.json()["items"][0]["first_name"] == "No"

    in_class = await client.get(
        f"/api/v1/tenant/students?class_id={p3}",
        headers=headers,
    )
    assert len(in_class.json()["items"]) == 1
    assert in_class.json()["items"][0]["first_name"] == "In"


async def test_roster_summary_counts(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU10")
    p3 = await _create_class(client, headers, "P3")

    await _enroll(client, headers, p3, first_name="Roster", last_name="One")
    unassigned = await _enroll(client, headers, p3, first_name="Roster", last_name="Two")
    await client.patch(
        f"/api/v1/tenant/students/{unassigned['id']}",
        json={"clear_class": True},
        headers=headers,
    )

    summary = await client.get("/api/v1/tenant/students/roster-summary", headers=headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["total"] == 2
    assert body["unassigned"] == 1
    p3_row = next(c for c in body["classes"] if c["class_id"] == p3)
    assert p3_row["count"] == 1
    assert p3_row["level"] == "P3"


async def test_import_students_bulk(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU11")
    p3 = await _create_class(client, headers, "P3")

    payload = {
        "rows": [
            import_row_payload(
                class_level="P3",
                first_name="Import",
                last_name="One",
            ),
            import_row_payload(
                first_name="Import",
                last_name="Two",
            ),
        ],
        "skip_duplicates": True,
        "dry_run": False,
    }
    resp = await client.post("/api/v1/tenant/students/import", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 2
    assert body["failed"] == 0

    listed = await client.get(f"/api/v1/tenant/students?class_id={p3}", headers=headers)
    assert len(listed.json()["items"]) == 2


async def test_import_students_dry_run(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU12")
    await _create_class(client, headers, "P4")

    payload = {
        "rows": [
            import_row_payload(
                class_level="P4",
                first_name="Dry",
                last_name="Run",
            ),
        ],
        "dry_run": True,
    }
    resp = await client.post("/api/v1/tenant/students/import", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["valid"] == 1
    assert resp.json()["created"] == 0

    empty = await client.get("/api/v1/tenant/students", headers=headers)
    assert empty.json()["items"] == []


async def test_import_ignores_provided_number(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU13")
    class_id = await _create_class(client, headers)
    created = await _enroll(client, headers, class_id, first_name="Existing", last_name="Student")
    existing_number = created["student_number"]

    # A sheet number that collides with an existing learner is ignored — the
    # importer always assigns a fresh, unique number.
    resp = await client.post(
        "/api/v1/tenant/students/import",
        json={
            "rows": [
                import_row_payload(
                    first_name="Fresh",
                    last_name="Import",
                ),
            ],
            "skip_duplicates": True,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created"] == 1
    assert resp.json()["skipped"] == 0

    listed = await client.get("/api/v1/tenant/students", headers=headers)
    numbers = [s["student_number"] for s in listed.json()["items"]]
    assert len(set(numbers)) == 2


async def test_import_skips_duplicate_name_in_class(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU13B")
    await _create_class(client, headers, "P3")
    payload = import_row_payload(first_name="Repeat", last_name="Learner", class_level="P3")

    first = await client.post(
        "/api/v1/tenant/students/import",
        json={"rows": [payload], "skip_duplicates": True},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["created"] == 1

    second = await client.post(
        "/api/v1/tenant/students/import",
        json={"rows": [payload], "skip_duplicates": True},
        headers=headers,
    )
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["created"] == 0
    assert body["skipped"] == 1
    assert body["results"][0]["status"] == "skipped"

    listed = await client.get("/api/v1/tenant/students", headers=headers)
    assert len(listed.json()["items"]) == 1


async def test_bulk_assign_students(client, admin_headers):
    headers = await _headers(client, admin_headers, "STU14")
    p3 = await _create_class(client, headers, "P3")
    p4 = await _create_class(client, headers, "P4")

    s1 = await _enroll(client, headers, p3, first_name="Bulk", last_name="One")
    s2 = await _enroll(client, headers, p3, first_name="Bulk", last_name="Two")
    ids = [s1["id"], s2["id"]]

    resp = await client.post(
        "/api/v1/tenant/students/bulk-assign",
        json={"student_ids": ids, "class_id": p4},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["updated"] == 2

    listed = await client.get(f"/api/v1/tenant/students?class_id={p4}", headers=headers)
    assert len(listed.json()["items"]) == 2


async def test_teacher_roster_scoped_to_assignments(client, admin_headers, db):
    from sqlalchemy import select

    from app.core.db import apply_bypass_guc
    from app.core.security import hash_password
    from app.models.enums import UserStatus
    from app.models.user import Role, TenantUser

    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "STU15",
        module_keys=["core", "students", "teachers", "academics"],
    )
    p3 = await _create_class(client, headers, "P3")
    p4 = await _create_class(client, headers, "P4")
    subject = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "MTH", "name": "Math", "ncdc_cycle": "cycle_1"},
        headers=headers,
    )
    assert subject.status_code in (200, 201), subject.text
    subject_id = subject.json()["id"]

    await _enroll(client, headers, p3, first_name="Mine", last_name="Class")
    await _enroll(client, headers, p4, first_name="Other", last_name="Class")

    from uuid import UUID

    tenant_id = UUID(onboard["tenant_id"])
    await apply_bypass_guc(db)
    role = await db.scalar(select(Role).where(Role.role_key == "teacher"))
    teacher = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id="0077",
        password_hash=hash_password("TempPass!2025"),
        name="Scoped Teacher",
        status=UserStatus.active,
    )
    db.add(teacher)
    await db.commit()

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={
            "username": f"0077@{onboard['school_code']}",
            "password": "TempPass!2025",
        },
    )
    assert login.status_code == 200, login.text
    t_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    summary = await client.get("/api/v1/tenant/students/roster-summary", headers=t_headers)
    assert summary.status_code == 200
    assert summary.json()["classes"] == []
    assert summary.json()["total"] == 0

    teacher_id = teacher.id
    assigned = await client.post(
        "/api/v1/tenant/teachers/assignments",
        json={
            "teacher_user_id": str(teacher_id),
            "class_id": p3,
            "subject_id": subject_id,
        },
        headers=headers,
    )
    assert assigned.status_code == 201, assigned.text

    summary = await client.get("/api/v1/tenant/students/roster-summary", headers=t_headers)
    body = summary.json()
    assert len(body["classes"]) == 1
    assert body["classes"][0]["class_id"] == p3
    assert body["total"] == 1
    assert body["unassigned"] == 0

    listed = await client.get(f"/api/v1/tenant/students?class_id={p3}", headers=t_headers)
    assert len(listed.json()["items"]) == 1
    assert listed.json()["items"][0]["first_name"] == "Mine"

    blocked = await client.get(f"/api/v1/tenant/students?class_id={p4}", headers=t_headers)
    assert blocked.status_code == 403

    unassigned = await client.get("/api/v1/tenant/students?unassigned=true", headers=t_headers)
    assert unassigned.status_code == 403

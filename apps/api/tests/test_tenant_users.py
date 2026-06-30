"""Phase 2 §4 — tenant user management."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio

PASSWORD = "ChangeMe!2025"


async def _headers(client, admin_headers, code: str):
    headers, _ = await onboard_and_login(client, admin_headers, code)
    return headers


async def test_list_users_includes_onboard_admin(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "USR1")
    resp = await client.get("/api/v1/tenant/users", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["login_id"] == "0001"
    assert body[0]["role"] == "school_admin"
    assert body[0]["username"] == f"0001@{onboard['school_code']}"


async def test_list_assignable_roles(client, admin_headers):
    headers = await _headers(client, admin_headers, "USR2")
    resp = await client.get("/api/v1/tenant/roles", headers=headers)
    assert resp.status_code == 200
    keys = {r["role_key"] for r in resp.json()}
    assert "teacher" in keys
    assert "platform_admin" not in keys


async def test_create_user(client, admin_headers):
    headers = await _headers(client, admin_headers, "USR3")
    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0002",
            "name": "Grace Namuli",
            "role_key": "teacher",
            "email": "grace@school.ug",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["login_id"] == "0002"
    assert body["role"] == "teacher"
    assert "password" not in body

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0002@{body['username'].split('@')[1]}", "password": "TempPass!2025"},
    )
    assert login.status_code == 200


async def test_create_user_auto_login_id(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "USR3A")
    preview = await client.get("/api/v1/tenant/users/next-login-id", headers=headers)
    assert preview.status_code == 200
    assert preview.json()["login_id"] == "0002"

    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "name": "Auto ID Teacher",
            "role_key": "teacher",
            "email": "auto@school.ug",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["login_id"] == "0002"

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={
            "username": f"0002@{onboard['school_code']}",
            "password": "TempPass!2025",
        },
    )
    assert login.status_code == 200


async def test_create_parent_requires_login_id(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "USR3B",
        module_keys=["core", "students", "academics", "parents_portal"],
    )
    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "name": "Guardian Missing ID",
            "role_key": "parent",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


async def test_create_staff_requires_email(client, admin_headers):
    headers = await _headers(client, admin_headers, "USR3C")
    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0099",
            "name": "No Email Teacher",
            "role_key": "teacher",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


async def test_duplicate_login_id(client, admin_headers):
    headers = await _headers(client, admin_headers, "USR4")
    payload = {
        "login_id": "0002",
        "name": "Another User",
        "role_key": "teacher",
        "email": "another@school.ug",
        "password": "TempPass!2025",
    }
    assert (await client.post("/api/v1/tenant/users", json=payload, headers=headers)).status_code == 201
    dup = await client.post("/api/v1/tenant/users", json=payload, headers=headers)
    assert dup.status_code == 409


async def test_disable_user_and_password_reset(client, admin_headers):
    headers = await _headers(client, admin_headers, "USR5")
    created = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0003",
            "name": "Peter Okello",
            "role_key": "bursar",
            "email": "peter@school.ug",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    user_id = created.json()["id"]

    reset = await client.post(
        f"/api/v1/tenant/users/{user_id}/password-reset",
        headers=headers,
    )
    assert reset.status_code == 200
    assert "temporary_password" in reset.json()
    assert len(reset.json()["temporary_password"]) >= 8

    disabled = await client.patch(
        f"/api/v1/tenant/users/{user_id}",
        json={"status": "disabled"},
        headers=headers,
    )
    assert disabled.status_code == 200
    assert disabled.json()["status"] == "disabled"


async def test_cannot_disable_self(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "USR6")
    me = await client.get("/api/v1/auth/me", headers=headers)
    user_id = me.json()["id"]
    resp = await client.patch(
        f"/api/v1/tenant/users/{user_id}",
        json={"status": "disabled"},
        headers=headers,
    )
    assert resp.status_code == 403


async def test_tenant_isolation_on_user_patch(client, admin_headers):
    headers_a = await _headers(client, admin_headers, "USR7A")
    headers_b = await _headers(client, admin_headers, "USR7B")
    users_b = await client.get("/api/v1/tenant/users", headers=headers_b)
    target = users_b.json()[0]["id"]

    resp = await client.patch(
        f"/api/v1/tenant/users/{target}",
        json={"name": "Hacked"},
        headers=headers_a,
    )
    assert resp.status_code == 404


async def test_teacher_cannot_create_user(client, admin_headers, db):
    from sqlalchemy import select

    from app.core.db import apply_bypass_guc
    from app.core.security import hash_password
    from app.models.enums import UserStatus
    from app.models.user import Role, TenantUser

    headers, onboard = await onboard_and_login(client, admin_headers, "USR8")
    tenant_id = onboard["tenant_id"]
    await apply_bypass_guc(db)
    role = await db.scalar(select(Role).where(Role.role_key == "teacher"))
    teacher = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id="0009",
        password_hash=hash_password(PASSWORD),
        name="Test Teacher",
        status=UserStatus.active,
    )
    db.add(teacher)
    await db.commit()

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": "0009@USR8", "password": PASSWORD},
    )
    teacher_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0010",
            "name": "New User",
            "role_key": "teacher",
            "password": "TempPass!2025",
        },
        headers=teacher_headers,
    )
    assert resp.status_code == 403


async def test_create_user_with_allowed_modules_narrows_access(client, admin_headers):
    # School subscribes to core, students, teachers, academics by default.
    headers, onboard = await onboard_and_login(client, admin_headers, "RBAC1")
    code = onboard["school_code"]
    created = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0030",
            "name": "Finance Only",
            "role_key": "teacher",
            "email": "finance@school.ug",
            "password": "TempPass!2025",
            "allowed_modules": ["students"],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["allowed_modules"] == ["students"]

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0030@{code}", "password": "TempPass!2025"},
    )
    assert login.status_code == 200, login.text
    user_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    changed = await client.post(
        "/api/v1/auth/tenant/change-password",
        json={"current_password": "TempPass!2025", "new_password": "TeacherPass!26"},
        headers=user_headers,
    )
    assert changed.status_code == 200, changed.text
    user_headers = {"Authorization": f"Bearer {changed.json()['access_token']}"}

    # /auth/me reflects the narrowed set (school modules ∩ allowed, plus core).
    me = await client.get("/api/v1/auth/me", headers=user_headers)
    assert me.status_code == 200
    assert set(me.json()["modules"]) == {"core", "students"}

    # Allowed module works...
    allowed = await client.get("/api/v1/tenant/students", headers=user_headers)
    assert allowed.status_code == 200, allowed.text

    # ...a module the school has but this user is not granted is blocked (403).
    blocked = await client.get("/api/v1/tenant/teachers/staff", headers=user_headers)
    assert blocked.status_code == 403, blocked.text


async def test_school_admin_ignores_allowed_modules(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "RBAC2")
    code = onboard["school_code"]
    created = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0031",
            "name": "Another Admin",
            "role_key": "school_admin",
            "email": "admin2@school.ug",
            "password": "TempPass!2025",
            "allowed_modules": ["students"],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    # Admins always keep full access — scoping is dropped.
    assert created.json()["allowed_modules"] is None

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0031@{code}", "password": "TempPass!2025"},
    )
    user_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = await client.get("/api/v1/auth/me", headers=user_headers)
    assert "teachers" in me.json()["modules"]


async def test_update_allowed_modules(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "RBAC3")
    code = onboard["school_code"]
    created = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0032",
            "name": "Scoped Later",
            "role_key": "teacher",
            "email": "scoped@school.ug",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    user_id = created.json()["id"]
    assert created.json()["allowed_modules"] is None

    patched = await client.patch(
        f"/api/v1/tenant/users/{user_id}",
        json={"allowed_modules": ["students"]},
        headers=headers,
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["allowed_modules"] == ["students"]

    # Clearing the restriction restores inheritance.
    cleared = await client.patch(
        f"/api/v1/tenant/users/{user_id}",
        json={"allowed_modules": None},
        headers=headers,
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["allowed_modules"] is None


async def test_allowed_modules_rejects_unknown_key(client, admin_headers):
    headers = await _headers(client, admin_headers, "RBAC4")
    resp = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0033",
            "name": "Bad Modules",
            "role_key": "teacher",
            "email": "badmods@school.ug",
            "password": "TempPass!2025",
            "allowed_modules": ["not_a_real_module"],
        },
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


async def test_roles_endpoint_requires_admin(client, admin_headers, db):
    from sqlalchemy import select

    from app.core.db import apply_bypass_guc
    from app.core.security import hash_password
    from app.models.enums import UserStatus
    from app.models.user import Role, TenantUser

    headers, onboard = await onboard_and_login(client, admin_headers, "RBAC5")
    tenant_id = onboard["tenant_id"]
    await apply_bypass_guc(db)
    role = await db.scalar(select(Role).where(Role.role_key == "teacher"))
    teacher = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id="0040",
        password_hash=hash_password(PASSWORD),
        name="Plain Teacher",
        status=UserStatus.active,
    )
    db.add(teacher)
    await db.commit()

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": "0040@RBAC5", "password": PASSWORD},
    )
    teacher_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Teachers may not enumerate roles or the user directory.
    assert (await client.get("/api/v1/tenant/roles", headers=teacher_headers)).status_code == 403
    assert (await client.get("/api/v1/tenant/users", headers=teacher_headers)).status_code == 403


async def test_import_teachers_bulk(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "IMP1")
    code = onboard["school_code"]
    resp = await client.post(
        "/api/v1/tenant/users/import/teachers",
        json={
            "rows": [
                {"login_id": "0011", "name": "Teacher One", "email": "t1@example.com", "role_key": "teacher"},
                {"login_id": "0012", "name": "Teacher Two", "email": "t2@example.com", "role_key": "deputy_head"},
            ],
            "generate_passwords": True,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 2
    assert body["failed"] == 0
    created = [r for r in body["results"] if r["status"] == "created"]
    assert len(created) == 2
    assert all(r["temporary_password"] for r in created if not r.get("email_sent"))

    first = next(r for r in created if r["identifier"] == "0011")
    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0011@{code}", "password": first["temporary_password"]},
    )
    assert login.status_code == 200


async def test_import_teachers_skips_duplicate(client, admin_headers):
    headers = await _headers(client, admin_headers, "IMP2")
    payload = {
        "rows": [{"login_id": "0020", "name": "Dup Test", "email": "dup@example.com", "role_key": "teacher"}],
        "default_password": "SharedPass!99",
        "generate_passwords": False,
    }
    assert (await client.post("/api/v1/tenant/users/import/teachers", json=payload, headers=headers)).status_code == 200
    second = await client.post("/api/v1/tenant/users/import/teachers", json=payload, headers=headers)
    assert second.json()["skipped"] == 1


async def test_import_guardians_uses_student_number_login(client, admin_headers):
    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "IMP3",
        module_keys=["core", "students", "academics", "parents_portal"],
    )
    code = onboard["school_code"]
    class_id = (
        await client.post(
            "/api/v1/tenant/classes",
            json={"level": "P3"},
            headers=headers,
        )
    ).json()["id"]
    from tests.enrollment_helpers import enrollment_payload

    enrolled = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, first_name="Kato", last_name="Okello"),
        headers=headers,
    )
    assert enrolled.status_code == 201, enrolled.text
    student_number = enrolled.json()["student_number"]

    resp = await client.post(
        "/api/v1/tenant/users/import/guardians",
        json={
            "rows": [
                {
                    "student_number": student_number,
                    "guardian_name": "Mary Namuli",
                }
            ],
            "default_password": "ParentPass!25",
            "generate_passwords": False,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1
    row = body["results"][0]
    assert row["username"] == f"{student_number}@{code}"

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"{student_number}@{code}", "password": "ParentPass!25"},
    )
    assert login.status_code == 200


async def test_import_guardians_skips_existing(client, admin_headers):
    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "IMP4",
        module_keys=["core", "students", "academics", "parents_portal"],
    )
    code = onboard["school_code"]
    class_id = (
        await client.post(
            "/api/v1/tenant/classes",
            json={"level": "P4"},
            headers=headers,
        )
    ).json()["id"]
    from tests.enrollment_helpers import enrollment_payload

    enrolled = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, first_name="Child", last_name="One"),
        headers=headers,
    )
    student_number = enrolled.json()["student_number"]

    payload = {
        "rows": [
            {
                "student_number": student_number,
                "guardian_name": "Guardian A",
            }
        ],
        "default_password": "ParentPass!25",
        "generate_passwords": False,
    }
    assert (await client.post("/api/v1/tenant/users/import/guardians", json=payload, headers=headers)).status_code == 200
    second = await client.post("/api/v1/tenant/users/import/guardians", json=payload, headers=headers)
    assert second.json()["skipped"] == 1

    users = await client.get("/api/v1/tenant/users?role=parent", headers=headers)
    assert users.status_code == 200
    assert len(users.json()) == 1
    assert users.json()[0]["login_id"] == student_number
    assert users.json()[0]["username"] == f"{student_number}@{code}"


async def test_import_guardians_rejects_unknown_student(client, admin_headers):
    headers = await _headers(client, admin_headers, "IMP5")
    resp = await client.post(
        "/api/v1/tenant/users/import/guardians",
        json={
            "rows": [{"student_number": "99990001", "guardian_name": "Jane Guardian"}],
            "default_password": "ParentPass!25",
            "generate_passwords": False,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 0
    assert body["failed"] == 1
    assert "not enrolled" in (body["results"][0]["message"] or "").lower()


async def test_password_reset_sets_must_change_flag(client, admin_headers):
    headers = await _headers(client, admin_headers, "PWD1")
    created = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0002",
            "name": "Reset Target",
            "role_key": "teacher",
            "email": "reset@school.ug",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    user_id = created.json()["id"]

    reset = await client.post(
        f"/api/v1/tenant/users/{user_id}/password-reset",
        headers=headers,
    )
    assert reset.status_code == 200
    temp = reset.json().get("temporary_password")
    assert temp is None or len(temp) >= 8

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": created.json()["username"], "password": temp or "unused"},
    )
    if temp:
        assert login.status_code == 200
        assert login.json().get("must_change_password") is True


async def test_change_password_clears_must_change(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "PWD2")
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200

    change = await client.post(
        "/api/v1/auth/tenant/change-password",
        json={"current_password": PASSWORD, "new_password": "NewSecure!2026"},
        headers=headers,
    )
    assert change.status_code == 200, change.text
    assert change.json().get("must_change_password") is False

    old_login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0001@{onboard['school_code']}", "password": PASSWORD},
    )
    assert old_login.status_code == 401

    new_login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0001@{onboard['school_code']}", "password": "NewSecure!2026"},
    )
    assert new_login.status_code == 200
    assert new_login.json().get("must_change_password") is False


async def test_tenant_api_blocked_until_password_changed(client, admin_headers, db):
    from sqlalchemy import select, update

    from app.core.db import apply_bypass_guc
    from app.models.user import TenantUser

    headers, onboard = await onboard_and_login(client, admin_headers, "PWD3")
    tenant_id = onboard["tenant_id"]
    await apply_bypass_guc(db)
    user_id = await db.scalar(
        select(TenantUser.id).where(TenantUser.tenant_id == tenant_id, TenantUser.login_id == "0001")
    )
    await db.execute(
        update(TenantUser).where(TenantUser.id == user_id).values(must_change_password=True)
    )
    await db.commit()

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0001@{onboard['school_code']}", "password": PASSWORD},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    blocked = await client.get("/api/v1/tenant/users", headers=auth)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "PASSWORD_CHANGE_REQUIRED"

    me = await client.get("/api/v1/auth/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["must_change_password"] is True

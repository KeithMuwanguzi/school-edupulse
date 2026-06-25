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
    headers = await _headers(client, admin_headers, "USR3B")
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


async def test_duplicate_login_id(client, admin_headers):
    headers = await _headers(client, admin_headers, "USR4")
    payload = {
        "login_id": "0002",
        "name": "Another User",
        "role_key": "teacher",
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
                {"login_id": "0011", "name": "Teacher One", "role_key": "teacher"},
                {"login_id": "0012", "name": "Teacher Two", "role_key": "deputy_head"},
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
    assert all(r["temporary_password"] for r in created)

    first = next(r for r in created if r["identifier"] == "0011")
    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0011@{code}", "password": first["temporary_password"]},
    )
    assert login.status_code == 200


async def test_import_teachers_skips_duplicate(client, admin_headers):
    headers = await _headers(client, admin_headers, "IMP2")
    payload = {
        "rows": [{"login_id": "0020", "name": "Dup Test", "role_key": "teacher"}],
        "default_password": "SharedPass!99",
        "generate_passwords": False,
    }
    assert (await client.post("/api/v1/tenant/users/import/teachers", json=payload, headers=headers)).status_code == 200
    second = await client.post("/api/v1/tenant/users/import/teachers", json=payload, headers=headers)
    assert second.json()["skipped"] == 1


async def test_import_guardians_uses_student_number_login(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "IMP3")
    code = onboard["school_code"]
    resp = await client.post(
        "/api/v1/tenant/users/import/guardians",
        json={
            "rows": [
                {
                    "student_number": "2203992",
                    "guardian_name": "Mary Namuli",
                    "student_first_name": "Kato",
                    "student_last_name": "Okello",
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
    assert row["username"] == f"2203992@{code}"

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"2203992@{code}", "password": "ParentPass!25"},
    )
    assert login.status_code == 200


async def test_import_guardians_skips_existing(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "IMP4")
    code = onboard["school_code"]
    payload = {
        "rows": [
            {
                "student_number": "3304001",
                "guardian_name": "Guardian A",
                "student_first_name": "Child",
                "student_last_name": "One",
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
    assert users.json()[0]["login_id"] == "3304001"
    assert users.json()[0]["username"] == f"3304001@{code}"

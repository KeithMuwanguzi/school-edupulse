"""Phase 2 §3 — classes & streams."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def _headers(client, admin_headers, code: str, modules: list[str] | None = None):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        code,
        module_keys=modules or ["core", "students", "teachers", "academics"],
    )
    return headers


async def test_list_classes_empty(client, admin_headers):
    headers = await _headers(client, admin_headers, "CLS1")
    resp = await client.get("/api/v1/tenant/classes", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_module_gate_blocks_without_academics(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "CLS2", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/classes", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "MODULE_NOT_SUBSCRIBED"
    assert resp.json()["module"] == "academics"


async def test_setup_primary_classes(client, admin_headers):
    headers = await _headers(client, admin_headers, "CLS3")
    resp = await client.post("/api/v1/tenant/classes/setup-primary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 7
    assert body[0]["level"] == "P1"
    assert body[6]["level"] == "P7"

    listed = await client.get("/api/v1/tenant/classes", headers=headers)
    assert len(listed.json()) == 7


async def test_setup_primary_idempotent_error(client, admin_headers):
    headers = await _headers(client, admin_headers, "CLS4")
    assert (await client.post("/api/v1/tenant/classes/setup-primary", headers=headers)).status_code == 200
    resp = await client.post("/api/v1/tenant/classes/setup-primary", headers=headers)
    assert resp.status_code == 422


async def test_create_class_and_duplicate_level(client, admin_headers):
    headers = await _headers(client, admin_headers, "CLS5")
    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P5"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["level"] == "P5"
    assert resp.json()["label"] == "Primary Five"

    dup = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P5"},
        headers=headers,
    )
    assert dup.status_code == 409


async def test_streams_crud(client, admin_headers):
    headers = await _headers(client, admin_headers, "CLS6")
    created = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P4"},
        headers=headers,
    )
    class_id = created.json()["id"]

    add_a = await client.post(
        f"/api/v1/tenant/classes/{class_id}/streams",
        json={"name": "A"},
        headers=headers,
    )
    assert add_a.status_code == 201
    assert len(add_a.json()["streams"]) == 1

    add_b = await client.post(
        f"/api/v1/tenant/classes/{class_id}/streams",
        json={"name": "B"},
        headers=headers,
    )
    assert add_b.status_code == 201

    dup = await client.post(
        f"/api/v1/tenant/classes/{class_id}/streams",
        json={"name": "A"},
        headers=headers,
    )
    assert dup.status_code == 409

    stream_id = add_b.json()["streams"][1]["id"]
    updated = await client.patch(
        f"/api/v1/tenant/classes/{class_id}/streams/{stream_id}",
        json={"name": "East"},
        headers=headers,
    )
    assert updated.status_code == 200
    names = [s["name"] for s in updated.json()["streams"]]
    assert "East" in names

    removed = await client.delete(
        f"/api/v1/tenant/classes/{class_id}/streams/{stream_id}",
        headers=headers,
    )
    assert removed.status_code == 200
    assert len(removed.json()["streams"]) == 1


async def test_tenant_isolation_on_class_patch(client, admin_headers):
    headers_a = await _headers(client, admin_headers, "CLS7A")
    headers_b = await _headers(client, admin_headers, "CLS7B")
    created = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P3"},
        headers=headers_b,
    )
    class_b = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/tenant/classes/{class_b}",
        json={"label": "Hacked"},
        headers=headers_a,
    )
    assert resp.status_code == 404


async def test_teacher_cannot_create_class(client, admin_headers, db):
    from app.core.db import apply_bypass_guc
    from app.core.security import hash_password
    from app.models.enums import UserStatus
    from app.models.user import Role, TenantUser
    from sqlalchemy import select

    headers, onboard = await onboard_and_login(
        client, admin_headers, "CLS8", module_keys=["core", "academics"]
    )
    tenant_id = onboard["tenant_id"]
    await apply_bypass_guc(db)
    role = await db.scalar(select(Role).where(Role.role_key == "teacher"))
    teacher = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id="0003",
        password_hash=hash_password("ChangeMe!2025"),
        name="Test Teacher",
        status=UserStatus.active,
    )
    db.add(teacher)
    await db.commit()

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": "0003@CLS8", "password": "ChangeMe!2025"},
    )
    teacher_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P1"},
        headers=teacher_headers,
    )
    assert resp.status_code == 403

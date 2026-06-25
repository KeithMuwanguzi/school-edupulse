"""Phase 2 §2 — subject catalogue."""
from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import select

from app.core.db import apply_bypass_guc, apply_tenant_guc
from app.core.security import hash_password
from app.models.audit import AuditLog
from app.models.enums import UserStatus
from app.models.subject import Subject
from app.models.user import Role, TenantUser
from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def test_list_subjects_empty_after_onboard(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SUB1")
    resp = await client.get("/api/v1/tenant/subjects", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_code_normalization_on_create(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SUB2A")
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={
            "code": "Eng",
            "name": "English",
            "ncdc_cycle": "cycle_2",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["code"] == "ENG"


async def test_create_subject(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SUB2")
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={
            "code": "ENG",
            "name": "English",
            "ncdc_cycle": "cycle_3",
            "sort_order": 1,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["code"] == "ENG"
    assert body["name"] == "English"
    assert body["ncdc_cycles"] == ["cycle_3"]
    assert body["ncdc_cycle"] == "cycle_3"
    assert body["is_active"] is True

    listed = await client.get("/api/v1/tenant/subjects", headers=headers)
    assert len(listed.json()) == 1


async def test_extend_cycles_on_duplicate_code(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SUB3")
    payload = {"code": "MATH", "name": "Mathematics", "ncdc_cycle": "cycle_3"}
    assert (
        await client.post("/api/v1/tenant/subjects", json=payload, headers=headers)
    ).status_code == 201
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "MATH", "name": "Maths", "ncdc_cycle": "cycle_2"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ncdc_cycles"] == ["cycle_2", "cycle_3"]
    assert body["name"] == "Mathematics"

    listed = await client.get("/api/v1/tenant/subjects", headers=headers)
    assert len(listed.json()) == 1


async def test_english_spans_p4_and_upper_primary(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SUB3B")
    assert (
        await client.post(
            "/api/v1/tenant/subjects",
            json={"code": "ENG", "name": "English", "ncdc_cycle": "cycle_2"},
            headers=headers,
        )
    ).status_code == 201

    extend = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "ENG", "name": "English", "ncdc_cycle": "cycle_3"},
        headers=headers,
    )
    assert extend.status_code == 200
    assert extend.json()["ncdc_cycles"] == ["cycle_2", "cycle_3"]

    listed = await client.get("/api/v1/tenant/subjects", headers=headers)
    assert len(listed.json()) == 1
    assert listed.json()[0]["code"] == "ENG"


async def test_update_subject_cycles(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SUB4")
    created = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "SST", "name": "Social Studies", "ncdc_cycle": "cycle_3"},
        headers=headers,
    )
    subject_id = created.json()["id"]
    resp = await client.patch(
        f"/api/v1/tenant/subjects/{subject_id}",
        json={
            "name": "Social Studies (SST)",
            "ncdc_cycles": ["cycle_2", "cycle_3"],
            "is_active": False,
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Social Studies (SST)"
    assert body["ncdc_cycles"] == ["cycle_2", "cycle_3"]
    assert body["is_active"] is False


async def test_soft_delete_subject(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "SUB5")
    created = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "SCI", "name": "Science", "ncdc_cycle": "cycle_3"},
        headers=headers,
    )
    subject_id = created.json()["id"]
    resp = await client.delete(
        f"/api/v1/tenant/subjects/{subject_id}",
        headers=headers,
    )
    assert resp.status_code == 204

    listed = await client.get("/api/v1/tenant/subjects", headers=headers)
    assert listed.json() == []


async def test_teacher_cannot_create_subject(client, admin_headers, db):
    headers, onboard = await onboard_and_login(client, admin_headers, "SUB6")
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
        json={"username": "0003@SUB6", "password": "ChangeMe!2025"},
    )
    teacher_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "ENG", "name": "English", "ncdc_cycle": "cycle_3"},
        headers=teacher_headers,
    )
    assert resp.status_code == 403


async def test_tenant_isolation_on_update(client, admin_headers):
    headers_a, _ = await onboard_and_login(client, admin_headers, "SUB7A")
    headers_b, _ = await onboard_and_login(client, admin_headers, "SUB7B")
    created = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "RE", "name": "Religious Education", "ncdc_cycle": "cycle_3"},
        headers=headers_b,
    )
    subject_b = created.json()["id"]

    resp = await client.patch(
        f"/api/v1/tenant/subjects/{subject_b}",
        json={"name": "Hacked"},
        headers=headers_a,
    )
    assert resp.status_code == 404


async def test_rls_hides_other_tenant_subjects(client, admin_headers, db):
    headers_a, onboard_a = await onboard_and_login(client, admin_headers, "SUB8A")
    _, onboard_b = await onboard_and_login(client, admin_headers, "SUB8B")

    await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "ENG", "name": "English", "ncdc_cycle": "cycle_3"},
        headers=headers_a,
    )

    tenant_b = UUID(onboard_b["tenant_id"])
    await apply_tenant_guc(db, tenant_b)
    rows = await db.scalars(select(Subject))
    assert list(rows) == []


async def test_audit_on_subject_create(client, admin_headers, db):
    headers, onboard = await onboard_and_login(client, admin_headers, "SUB9")
    await client.post(
        "/api/v1/tenant/subjects",
        json={"code": "ENG", "name": "English", "ncdc_cycle": "cycle_1"},
        headers=headers,
    )

    row = await db.scalar(
        select(AuditLog.action)
        .where(
            AuditLog.tenant_id == UUID(onboard["tenant_id"]),
            AuditLog.action == "subject.created",
        )
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    assert row == "subject.created"

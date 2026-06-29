"""Parent circulars — compose, publish, inbox."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.audit import AuditLog
from app.models.enums import UserStatus
from app.models.user import Role, TenantUser
from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def test_create_publish_and_inbox(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "CIRC1")

    create = await client.post(
        "/api/v1/tenant/circulars",
        json={
            "title": "Mid-term break reminder",
            "body": "School closes Friday 12:00. Resume Monday 8:00.",
            "audience": "all_parents",
            "priority": "normal",
        },
        headers=headers,
    )
    assert create.status_code == 201
    circular_id = create.json()["id"]
    assert create.json()["status"] == "draft"

    publish = await client.post(
        f"/api/v1/tenant/circulars/{circular_id}/publish",
        headers=headers,
    )
    assert publish.status_code == 200
    assert publish.json()["status"] == "published"
    assert publish.json()["published_at"] is not None

    inbox = await client.get("/api/v1/tenant/circulars/inbox", headers=headers)
    assert inbox.status_code == 200
    assert len(inbox.json()) == 1
    assert inbox.json()[0]["title"] == "Mid-term break reminder"


async def test_class_circular_requires_class(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "CIRC2")

    resp = await client.post(
        "/api/v1/tenant/circulars",
        json={
            "title": "P.7 meeting",
            "body": "Parents meeting on Saturday.",
            "audience": "class",
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_teacher_cannot_create_circular(client, admin_headers, db):
    from app.core.db import apply_bypass_guc

    headers, onboard = await onboard_and_login(client, admin_headers, "CIRC3")
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
        json={"username": "0003@CIRC3", "password": "ChangeMe!2025"},
    )
    teacher_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.post(
        "/api/v1/tenant/circulars",
        json={
            "title": "Staff only",
            "body": "Should fail.",
            "audience": "all_parents",
        },
        headers=teacher_headers,
    )
    assert resp.status_code == 403


async def test_audit_on_publish(client, admin_headers, db):
    headers, onboard = await onboard_and_login(client, admin_headers, "CIRC4")

    create = await client.post(
        "/api/v1/tenant/circulars",
        json={
            "title": "Fee payment",
            "body": "Term 2 fees due by end of month.",
            "audience": "all_parents",
        },
        headers=headers,
    )
    circular_id = create.json()["id"]
    await client.post(f"/api/v1/tenant/circulars/{circular_id}/publish", headers=headers)

    row = await db.scalar(
        select(AuditLog.action)
        .where(
            AuditLog.tenant_id == onboard["tenant_id"],
            AuditLog.action == "circular.published",
        )
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    assert row == "circular.published"

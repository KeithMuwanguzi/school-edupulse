"""Phase 2 §1 — academic calendar management."""
from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.academic import AcademicYear, Term
from app.models.audit import AuditLog
from app.models.enums import AcademicYearStatus, TermStatus, UserStatus
from app.models.user import Role, TenantUser
from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def test_list_years_after_onboard(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "CAL1")
    resp = await client.get("/api/v1/tenant/academic-years", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["label"] == onboard["academic_year"]["label"]
    assert len(body[0]["terms"]) == 3


async def test_create_academic_year(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "CAL2")
    resp = await client.post(
        "/api/v1/tenant/academic-years",
        json={"label": "2027"},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["label"] == "2027"
    assert body["status"] == "upcoming"
    assert len(body["terms"]) == 3
    assert body["terms"][0]["term_number"] == 1


async def test_duplicate_year_label_rejected(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "CAL3")
    resp = await client.post(
        "/api/v1/tenant/academic-years",
        json={"label": onboard["academic_year"]["label"]},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_update_term_dates(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "CAL4")
    year_id = onboard["academic_year"]["id"]
    years = await client.get("/api/v1/tenant/academic-years", headers=headers)
    term_id = years.json()[0]["terms"][0]["id"]
    resp = await client.patch(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}",
        json={"starts_on": "2026-02-02", "ends_on": "2026-05-03"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["starts_on"] == "2026-02-02"


async def test_activate_year(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "CAL5")
    create = await client.post(
        "/api/v1/tenant/academic-years",
        json={"label": "2028"},
        headers=headers,
    )
    year_id = create.json()["id"]
    resp = await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/activate",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    ctx = await client.get("/api/v1/tenant/academic-context", headers=headers)
    assert ctx.json()["academic_year"]["label"] == "2028"


async def test_activate_term(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "CAL6")
    year_id = onboard["academic_year"]["id"]
    years = await client.get("/api/v1/tenant/academic-years", headers=headers)
    term3_id = years.json()[0]["terms"][2]["id"]
    resp = await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term3_id}/activate",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    ctx = await client.get("/api/v1/tenant/academic-context", headers=headers)
    assert ctx.json()["active_term"]["term_number"] == 3


async def test_academic_context_includes_terms(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "CAL7")
    resp = await client.get("/api/v1/tenant/academic-context", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["academic_year"] is not None
    assert len(body["terms"]) == 3


async def test_teacher_cannot_create_year(client, admin_headers, db):
    from app.core.db import apply_bypass_guc

    headers, onboard = await onboard_and_login(client, admin_headers, "CAL8")
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
        json={"username": "0003@CAL8", "password": "ChangeMe!2025"},
    )
    assert login.status_code == 200
    teacher_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.post(
        "/api/v1/tenant/academic-years",
        json={"label": "2029"},
        headers=teacher_headers,
    )
    assert resp.status_code == 403


async def test_tenant_isolation_on_year_patch(client, admin_headers):
    headers_a, onboard_a = await onboard_and_login(client, admin_headers, "CAL9A")
    _, onboard_b = await onboard_and_login(client, admin_headers, "CAL9B")
    year_b = onboard_b["academic_year"]["id"]

    resp = await client.patch(
        f"/api/v1/tenant/academic-years/{year_b}",
        json={"starts_on": "2026-01-01"},
        headers=headers_a,
    )
    assert resp.status_code == 404


async def test_audit_on_year_activate(client, admin_headers, db):
    headers, onboard = await onboard_and_login(client, admin_headers, "CAL10")
    create = await client.post(
        "/api/v1/tenant/academic-years",
        json={"label": "2030"},
        headers=headers,
    )
    year_id = create.json()["id"]
    await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/activate",
        headers=headers,
    )

    row = await db.scalar(
        select(AuditLog.action)
        .where(
            AuditLog.tenant_id == UUID(onboard["tenant_id"]),
            AuditLog.action == "academic_year.activated",
        )
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    assert row == "academic_year.activated"

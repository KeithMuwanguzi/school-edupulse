"""Term calendar — school programme events within a term."""
from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.audit import AuditLog
from app.models.enums import UserStatus
from app.models.user import Role, TenantUser
from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def _year_and_term(headers, client):
    years = await client.get("/api/v1/tenant/academic-years", headers=headers)
    year = years.json()[0]
    term = year["terms"][0]
    await client.patch(
        f"/api/v1/tenant/academic-years/{year['id']}/terms/{term['id']}",
        json={"starts_on": "2026-02-02", "ends_on": "2026-05-03"},
        headers=headers,
    )
    return year["id"], term["id"]


async def test_create_and_list_term_calendar_event(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "TCAL1")
    year_id, term_id = await _year_and_term(headers, client)

    create = await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events",
        json={
            "event_type": "visitation",
            "title": "P.7 visitation",
            "starts_on": "2026-03-15",
            "ends_on": "2026-03-15",
            "description": "Parents welcome",
        },
        headers=headers,
    )
    assert create.status_code == 201
    body = create.json()
    assert body["title"] == "P.7 visitation"
    assert body["event_type"] == "visitation"
    assert body["term_id"] == term_id

    listed = await client.get(
        f"/api/v1/tenant/academic-years/{year_id}/calendar-events",
        headers=headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    filtered = await client.get(
        f"/api/v1/tenant/academic-years/{year_id}/calendar-events?term_id={term_id}",
        headers=headers,
    )
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1


async def test_update_term_calendar_event(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "TCAL2")
    year_id, term_id = await _year_and_term(headers, client)

    create = await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events",
        json={
            "event_type": "sports_day",
            "title": "Sports day",
            "starts_on": "2026-04-01",
            "ends_on": "2026-04-01",
        },
        headers=headers,
    )
    event_id = create.json()["id"]

    patch = await client.patch(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events/{event_id}",
        json={"title": "Annual sports day", "event_type": "sports_day"},
        headers=headers,
    )
    assert patch.status_code == 200
    assert patch.json()["title"] == "Annual sports day"


async def test_delete_term_calendar_event(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "TCAL3")
    year_id, term_id = await _year_and_term(headers, client)

    create = await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events",
        json={
            "event_type": "short_holiday",
            "title": "Mid-term break",
            "starts_on": "2026-03-20",
            "ends_on": "2026-03-22",
        },
        headers=headers,
    )
    event_id = create.json()["id"]

    delete = await client.delete(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events/{event_id}",
        headers=headers,
    )
    assert delete.status_code == 204

    listed = await client.get(
        f"/api/v1/tenant/academic-years/{year_id}/calendar-events",
        headers=headers,
    )
    assert listed.json() == []


async def test_event_outside_term_rejected(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "TCAL4")
    year_id, term_id = await _year_and_term(headers, client)

    resp = await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events",
        json={
            "event_type": "exam_period",
            "title": "End-of-term exams",
            "starts_on": "2026-06-01",
            "ends_on": "2026-06-10",
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_teacher_cannot_create_calendar_event(client, admin_headers, db):
    from app.core.db import apply_bypass_guc

    headers, onboard = await onboard_and_login(client, admin_headers, "TCAL5")
    year_id, term_id = await _year_and_term(headers, client)
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
        json={"username": "0003@TCAL5", "password": "ChangeMe!2025"},
    )
    teacher_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events",
        json={
            "event_type": "class_meeting",
            "title": "Staff meeting",
            "starts_on": "2026-03-01",
            "ends_on": "2026-03-01",
        },
        headers=teacher_headers,
    )
    assert resp.status_code == 403


async def test_tenant_isolation_on_calendar_event(client, admin_headers):
    headers_a, _ = await onboard_and_login(client, admin_headers, "TCAL6A")
    headers_b, onboard_b = await onboard_and_login(client, admin_headers, "TCAL6B")
    year_b = onboard_b["academic_year"]["id"]
    years_b = await client.get("/api/v1/tenant/academic-years", headers=headers_b)
    term_b = years_b.json()[0]["terms"][0]["id"]

    resp = await client.get(
        f"/api/v1/tenant/academic-years/{year_b}/calendar-events",
        headers=headers_a,
    )
    assert resp.status_code == 200
    assert resp.json() == []

    create = await client.post(
        f"/api/v1/tenant/academic-years/{year_b}/terms/{term_b}/calendar-events",
        json={
            "event_type": "opening_day",
            "title": "Term opens",
            "starts_on": "2026-02-02",
            "ends_on": "2026-02-02",
        },
        headers=headers_b,
    )
    event_id = create.json()["id"]

    patch = await client.patch(
        f"/api/v1/tenant/academic-years/{year_b}/terms/{term_b}/calendar-events/{event_id}",
        json={"title": "Hacked"},
        headers=headers_a,
    )
    assert patch.status_code == 404


async def test_audit_on_calendar_event_create(client, admin_headers, db):
    headers, onboard = await onboard_and_login(client, admin_headers, "TCAL7")
    year_id, term_id = await _year_and_term(headers, client)

    await client.post(
        f"/api/v1/tenant/academic-years/{year_id}/terms/{term_id}/calendar-events",
        json={
            "event_type": "closing_day",
            "title": "Term closes",
            "starts_on": "2026-05-03",
            "ends_on": "2026-05-03",
        },
        headers=headers,
    )

    row = await db.scalar(
        select(AuditLog.action)
        .where(
            AuditLog.tenant_id == UUID(onboard["tenant_id"]),
            AuditLog.action == "term_calendar_event.created",
        )
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    assert row == "term_calendar_event.created"

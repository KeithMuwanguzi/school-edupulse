"""Phase 2 §8 — grading scales by NCDC section."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio


async def _headers(client, admin_headers, code: str):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        code,
        module_keys=["core", "students", "academics"],
    )
    return headers


async def _create_subject(client, headers, code: str, cycle: str) -> str:
    resp = await client.post(
        "/api/v1/tenant/subjects",
        json={"code": code, "name": code.title(), "ncdc_cycle": cycle},
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def test_config_grouped_by_cycle_sections(client, admin_headers):
    headers = await _headers(client, admin_headers, "GRD1")
    await _create_subject(client, headers, "LIT", "cycle_1")
    await _create_subject(client, headers, "ENG", "cycle_3")

    resp = await client.get("/api/v1/tenant/grading/config", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["sections"]) == 3
    p1 = next(s for s in body["sections"] if s["cycle"] == "cycle_1")
    p7 = next(s for s in body["sections"] if s["cycle"] == "cycle_3")
    assert len(p1["subjects"]) == 1
    assert len(p7["subjects"]) == 1
    assert p1["scales"] == []
    assert body["aggregate_divisions"] == []


async def test_create_scale_and_ranges(client, admin_headers):
    headers = await _headers(client, admin_headers, "GRD2")
    await _create_subject(client, headers, "ENG", "cycle_3")

    scale = await client.post(
        "/api/v1/tenant/grading/scales",
        json={"name": "Standard PLE", "ncdc_cycle": "cycle_3"},
        headers=headers,
    )
    assert scale.status_code == 201, scale.text
    scale_id = scale.json()["id"]

    band = await client.post(
        f"/api/v1/tenant/grading/scales/{scale_id}/ranges",
        json={
            "label": "Distinction 1",
            "aggregate_weight": 1,
            "min_mark": 90,
            "max_mark": 100,
            "class_teacher_comment": "Excellent effort this term.",
            "head_teacher_comment": "A role model to peers.",
        },
        headers=headers,
    )
    assert band.status_code == 201, band.text

    config = await client.get("/api/v1/tenant/grading/config", headers=headers)
    section = next(s for s in config.json()["sections"] if s["cycle"] == "cycle_3")
    assert len(section["scales"]) == 1
    assert len(section["scales"][0]["ranges"]) == 1
    band = section["scales"][0]["ranges"][0]
    assert band["class_teacher_comment"] == "Excellent effort this term."
    assert band["head_teacher_comment"] == "A role model to peers."


async def test_assign_subject_to_scale(client, admin_headers):
    headers = await _headers(client, admin_headers, "GRD3")
    subject_id = await _create_subject(client, headers, "CA", "cycle_1")
    special = await client.post(
        "/api/v1/tenant/grading/scales",
        json={"name": "Creative Arts scale", "ncdc_cycle": "cycle_1"},
        headers=headers,
    )
    scale_id = special.json()["id"]

    assigned = await client.patch(
        f"/api/v1/tenant/grading/subjects/{subject_id}/scale",
        json={"grading_scale_id": scale_id},
        headers=headers,
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["grading_scale_id"] == scale_id


async def test_rejects_wrong_cycle_scale_assignment(client, admin_headers):
    headers = await _headers(client, admin_headers, "GRD4")
    subject_id = await _create_subject(client, headers, "ENG", "cycle_3")
    scale = await client.post(
        "/api/v1/tenant/grading/scales",
        json={"name": "Lower primary", "ncdc_cycle": "cycle_1"},
        headers=headers,
    )
    scale_id = scale.json()["id"]

    resp = await client.patch(
        f"/api/v1/tenant/grading/subjects/{subject_id}/scale",
        json={"grading_scale_id": scale_id},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_teacher_cannot_access_grading_config(client, admin_headers):
    headers, onboard = await onboard_and_login(
        client,
        admin_headers,
        "GRD5",
        module_keys=["core", "students", "academics"],
    )
    teacher = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0088",
            "name": "Grade Teacher",
            "role_key": "teacher",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert teacher.status_code == 201
    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0088@{onboard['school_code']}", "password": "TempPass!2025"},
    )
    assert login.status_code == 200
    t_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resp = await client.get("/api/v1/tenant/grading/config", headers=t_headers)
    assert resp.status_code == 403

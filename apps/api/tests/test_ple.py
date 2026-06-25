"""P7 PLE candidacy — Phase 2 §11."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

pytestmark = pytest.mark.asyncio

MODULES = ["core", "students", "academics", "assessment", "reportcards"]


async def _headers(client, admin_headers, code: str):
    return await onboard_and_login(client, admin_headers, code, module_keys=MODULES)


async def _create_class(client, headers, level: str = "P7") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": level, "label": f"{level} East"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _enroll_and_register(client, headers, class_id: str) -> str:
    created = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            last_name="Okello",
            first_name="James",
        ),
        headers=headers,
    )
    assert created.status_code == 201, created.text
    student_id = created.json()["id"]

    start = await client.post(
        "/api/v1/tenant/registration",
        json={"student_id": student_id},
        headers=headers,
    )
    assert start.status_code == 201, start.text
    detail = start.json()
    responses = []
    for sec in detail["sections"]:
        for req in sec["requirements"]:
            if req["is_required"]:
                val = True if req["field_type"] == "checkbox" else "ok"
                responses.append(
                    {"requirement_id": req["id"], "value": val, "status": "satisfied"}
                )
    upd = await client.put(
        f"/api/v1/tenant/registration/{detail['id']}/responses",
        json={"responses": responses},
        headers=headers,
    )
    assert upd.status_code == 200, upd.text
    return student_id


async def test_ple_module_gate(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "PLE1", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/ple/summary", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["module"] == "assessment"


async def test_nominate_and_list_p7_candidate(client, admin_headers):
    headers, _ = await _headers(client, admin_headers, "PLE2")
    class_id = await _create_class(client, headers, "P7")
    student_id = await _enroll_and_register(client, headers, class_id)

    summary = await client.get("/api/v1/tenant/ple/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()["total_p7_registered"] == 1
    assert summary.json()["not_nominated"] == 1

    eligible = await client.get("/api/v1/tenant/ple/eligible", headers=headers)
    assert eligible.status_code == 200
    assert len(eligible.json()) == 1
    assert eligible.json()[0]["student_id"] == student_id

    nominated = await client.post(
        "/api/v1/tenant/ple/candidates",
        json={"student_ids": [student_id]},
        headers=headers,
    )
    assert nominated.status_code == 201, nominated.text
    body = nominated.json()
    assert len(body) == 1
    assert body[0]["status"] == "nominated"
    assert body[0]["student"]["student_id"] == student_id
    candidate_id = body[0]["id"]

    listed = await client.get("/api/v1/tenant/ple/candidates", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    eligible_after = await client.get("/api/v1/tenant/ple/eligible", headers=headers)
    assert eligible_after.status_code == 200
    assert len(eligible_after.json()) == 0

    registered = await client.patch(
        f"/api/v1/tenant/ple/candidates/{candidate_id}",
        json={"status": "registered", "candidate_number": "UNEB-2026-001"},
        headers=headers,
    )
    assert registered.status_code == 200, registered.text
    assert registered.json()["status"] == "registered"
    assert registered.json()["candidate_number"] == "UNEB-2026-001"
    assert registered.json()["registered_on"] is not None


async def test_rejects_non_p7_nomination(client, admin_headers):
    headers, _ = await _headers(client, admin_headers, "PLE3")
    class_id = await _create_class(client, headers, "P5")
    student_id = await _enroll_and_register(client, headers, class_id)

    resp = await client.post(
        "/api/v1/tenant/ple/candidates",
        json={"student_ids": [student_id]},
        headers=headers,
    )
    assert resp.status_code == 422

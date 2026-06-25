"""Boarding & Hostel add-on — Phase 2 §19."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

pytestmark = pytest.mark.asyncio

MODULES = ["core", "students", "academics", "hostel"]


async def _onboard(client, admin_headers, code: str):
    return await onboard_and_login(client, admin_headers, code, module_keys=MODULES)


async def _create_class(client, headers, level: str = "P5") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes", json={"level": level}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_hostel(client, headers, **overrides) -> dict:
    payload = {"name": "St. Mary's", "gender": "mixed"}
    payload.update(overrides)
    resp = await client.post("/api/v1/tenant/hostels", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_room(client, headers, hostel_id: str, **overrides) -> dict:
    payload = {"name": "Room 1", "capacity": 2}
    payload.update(overrides)
    resp = await client.post(
        f"/api/v1/tenant/hostels/{hostel_id}/rooms", json=payload, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _enroll(client, headers, class_id: str, **overrides) -> dict:
    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(class_id=class_id, **overrides),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_module_gate_blocks_without_hostel(client, admin_headers):
    headers, _ = await onboard_and_login(
        client, admin_headers, "HST1", module_keys=["core", "students"]
    )
    resp = await client.get("/api/v1/tenant/hostels", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["module"] == "hostel"


async def test_create_hostel_with_rooms(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "HST2")
    hostel = await _create_hostel(client, headers, name="Kabaka House", code="KH", capacity=None)
    await _create_room(client, headers, hostel["id"], name="A1", capacity=3)
    await _create_room(client, headers, hostel["id"], name="A2", capacity=2)

    detail = await client.get(
        f"/api/v1/tenant/hostels/{hostel['id']}", headers=headers
    )
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["room_count"] == 2
    # No explicit capacity -> derived from room beds.
    assert body["effective_capacity"] == 5
    assert body["occupied"] == 0
    assert len(body["rooms"]) == 2


async def test_enroll_boarder_into_hostel(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "HST3")
    class_id = await _create_class(client, headers)
    hostel = await _create_hostel(client, headers, gender="boys", capacity=10)
    room = await _create_room(client, headers, hostel["id"], capacity=2)

    student = await _enroll(
        client,
        headers,
        class_id,
        gender="male",
        residence="boarder",
        hostel_id=hostel["id"],
        hostel_room_id=room["id"],
    )
    assert student["hostel_id"] == hostel["id"]
    assert student["hostel_room_id"] == room["id"]
    assert student["residence"] == "boarder"

    detail = await client.get(
        f"/api/v1/tenant/hostels/{hostel['id']}", headers=headers
    )
    body = detail.json()
    assert body["occupied"] == 1
    assert len(body["residents"]) == 1
    assert body["rooms"][0]["occupied"] == 1


async def test_gender_mismatch_rejected(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "HST4")
    class_id = await _create_class(client, headers)
    hostel = await _create_hostel(client, headers, gender="boys")

    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            gender="female",
            residence="boarder",
            hostel_id=hostel["id"],
        ),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text


async def test_capacity_enforced(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "HST5")
    class_id = await _create_class(client, headers)
    hostel = await _create_hostel(client, headers, gender="mixed", capacity=1)

    await _enroll(
        client, headers, class_id, residence="boarder", hostel_id=hostel["id"]
    )
    resp = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id, residence="boarder", hostel_id=hostel["id"]
        ),
        headers=headers,
    )
    assert resp.status_code == 422, resp.text
    assert "full" in resp.json()["detail"].lower()


async def test_options_filter_by_gender(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "HST6")
    boys = await _create_hostel(client, headers, name="Boys House", gender="boys")
    await _create_hostel(client, headers, name="Girls House", gender="girls")

    resp = await client.get(
        "/api/v1/tenant/hostels/options?gender=male", headers=headers
    )
    assert resp.status_code == 200, resp.text
    ids = {h["id"] for h in resp.json()}
    assert boys["id"] in ids
    names = {h["name"] for h in resp.json()}
    assert "Girls House" not in names


async def test_allocate_and_checkout(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "HST7")
    class_id = await _create_class(client, headers)
    hostel = await _create_hostel(client, headers, gender="mixed", capacity=5)
    room = await _create_room(client, headers, hostel["id"], capacity=2)
    student = await _enroll(client, headers, class_id)

    alloc = await client.post(
        "/api/v1/tenant/hostels/allocate",
        json={
            "student_id": student["id"],
            "hostel_id": hostel["id"],
            "hostel_room_id": room["id"],
        },
        headers=headers,
    )
    assert alloc.status_code == 200, alloc.text
    assert alloc.json()["occupied"] == 1

    out = await client.post(
        "/api/v1/tenant/hostels/checkout",
        json={"student_id": student["id"]},
        headers=headers,
    )
    assert out.status_code == 204, out.text

    detail = await client.get(
        f"/api/v1/tenant/hostels/{hostel['id']}", headers=headers
    )
    assert detail.json()["occupied"] == 0


async def test_delete_hostel_with_residents_blocked(client, admin_headers):
    headers, _ = await _onboard(client, admin_headers, "HST8")
    class_id = await _create_class(client, headers)
    hostel = await _create_hostel(client, headers, gender="mixed", capacity=5)
    await _enroll(
        client, headers, class_id, residence="boarder", hostel_id=hostel["id"]
    )

    resp = await client.delete(
        f"/api/v1/tenant/hostels/{hostel['id']}", headers=headers
    )
    assert resp.status_code == 409, resp.text

"""Finance module — fee structures, invoicing, manual payments."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login
from tests.enrollment_helpers import enrollment_payload

pytestmark = pytest.mark.asyncio


async def _create_class(client, headers, label: str = "P5 East") -> str:
    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": "P5", "label": label},
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
            residence="day",
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


async def _finance_headers(client, admin_headers, code: str):
    return await onboard_and_login(
        client,
        admin_headers,
        code,
        module_keys=["core", "students", "academics", "finance"],
    )


async def _setup_structure(client, headers, extra_lines: list[dict] | None = None) -> dict:
    created = await client.post(
        "/api/v1/tenant/finance/structures",
        json={"name": "Term fees 2025"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    structure = created.json()
    lines = extra_lines or [
        {"label": "Tuition", "amount_ugx": 350_000, "applies_to": "all"},
    ]
    for line in lines:
        resp = await client.post(
            f"/api/v1/tenant/finance/structures/{structure['id']}/lines",
            json=line,
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
    activated = await client.post(
        f"/api/v1/tenant/finance/structures/{structure['id']}/activate",
        headers=headers,
    )
    assert activated.status_code == 200, activated.text
    return activated.json()


async def _create_class_level(client, headers, level: str, label: str) -> str:
    resp = await client.post(
        "/api/v1/tenant/classes",
        json={"level": level, "label": label},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _enroll_student(client, headers, class_id: str, residence: str = "day") -> str:
    created = await client.post(
        "/api/v1/tenant/students",
        json=enrollment_payload(
            class_id=class_id,
            last_name="Okello",
            first_name="James",
            residence=residence,
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


async def test_fee_structure_and_invoice_flow(client, admin_headers):
    headers, _ = await _finance_headers(client, admin_headers, "FIN1")
    class_id = await _create_class(client, headers)
    student_id = await _enroll_and_register(client, headers, class_id)
    await _setup_structure(client, headers)

    summary_before = await client.get("/api/v1/tenant/finance/summary", headers=headers)
    assert summary_before.status_code == 200
    assert summary_before.json()["invoiced_count"] == 0
    assert summary_before.json()["registered_count"] == 1

    generated = await client.post("/api/v1/tenant/finance/invoices/generate", headers=headers)
    assert generated.status_code == 200, generated.text
    assert generated.json()["created"] == 1

    invoices = await client.get("/api/v1/tenant/finance/invoices", headers=headers)
    assert invoices.status_code == 200
    body = invoices.json()
    assert len(body) == 1
    assert body[0]["student_id"] == student_id
    assert body[0]["total_ugx"] == 350_000
    assert body[0]["status"] == "unpaid"
    invoice_id = body[0]["id"]

    payment = await client.post(
        f"/api/v1/tenant/finance/invoices/{invoice_id}/payments",
        json={"amount_ugx": 150_000, "method": "cash", "reference": "RCPT-001"},
        headers=headers,
    )
    assert payment.status_code == 201, payment.text
    paid = payment.json()
    assert paid["amount_paid_ugx"] == 150_000
    assert paid["status"] == "partial"
    assert len(paid["payments"]) == 1

    finish = await client.post(
        f"/api/v1/tenant/finance/invoices/{invoice_id}/payments",
        json={"amount_ugx": 200_000, "method": "mtn_momo", "reference": "MM-123"},
        headers=headers,
    )
    assert finish.status_code == 201, finish.text
    assert finish.json()["status"] == "paid"


async def test_bursar_can_record_payments(client, admin_headers):
    headers, onboard = await _finance_headers(client, admin_headers, "FIN2")
    class_id = await _create_class(client, headers)
    await _enroll_and_register(client, headers, class_id)
    await _setup_structure(client, headers)
    await client.post("/api/v1/tenant/finance/invoices/generate", headers=headers)

    bursar = await client.post(
        "/api/v1/tenant/users",
        json={
            "login_id": "0004",
            "name": "Finance Officer",
            "role_key": "bursar",
            "password": "TempPass!2025",
        },
        headers=headers,
    )
    assert bursar.status_code == 201, bursar.text

    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0004@{onboard['school_code']}", "password": "TempPass!2025"},
    )
    assert login.status_code == 200
    bursar_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    invoices = await client.get("/api/v1/tenant/finance/invoices", headers=bursar_headers)
    assert invoices.status_code == 200
    invoice_id = invoices.json()[0]["id"]

    denied = await client.post(
        "/api/v1/tenant/finance/structures",
        json={"name": "Should fail"},
        headers=bursar_headers,
    )
    assert denied.status_code == 403

    payment = await client.post(
        f"/api/v1/tenant/finance/invoices/{invoice_id}/payments",
        json={"amount_ugx": 50_000, "method": "cash"},
        headers=bursar_headers,
    )
    assert payment.status_code == 201, payment.text


async def test_finance_module_gate(client, admin_headers):
    headers, _ = await onboard_and_login(
        client,
        admin_headers,
        "FIN3",
        module_keys=["core", "students"],
    )
    resp = await client.get("/api/v1/tenant/finance/summary", headers=headers)
    assert resp.status_code == 403


async def test_class_level_fee_applies_to_matching_class(client, admin_headers):
    headers, _ = await _finance_headers(client, admin_headers, "FIN4")
    p4_class = await _create_class_level(client, headers, "P4", "Primary Four")
    p5_class = await _create_class_level(client, headers, "P5", "Primary Five")
    p4_student = await _enroll_student(client, headers, p4_class, residence="boarder")
    p5_student = await _enroll_student(client, headers, p5_class, residence="boarder")

    await _setup_structure(
        client,
        headers,
        extra_lines=[
            {"label": "Fees", "amount_ugx": 900_000, "applies_to": "boarder"},
            {"label": "Trip", "amount_ugx": 50_000, "applies_to": "class_level", "class_level": "P4"},
            {"label": "Fees", "amount_ugx": 850_000, "applies_to": "day"},
        ],
    )

    generated = await client.post("/api/v1/tenant/finance/invoices/generate", headers=headers)
    assert generated.status_code == 200, generated.text
    assert generated.json()["created"] == 2

    invoices = await client.get("/api/v1/tenant/finance/invoices", headers=headers)
    assert invoices.status_code == 200
    by_student = {row["student_id"]: row for row in invoices.json()}
    assert by_student[p4_student]["total_ugx"] == 950_000
    assert by_student[p5_student]["total_ugx"] == 900_000

    p4_detail = await client.get(
        f"/api/v1/tenant/finance/invoices/{by_student[p4_student]['id']}",
        headers=headers,
    )
    assert p4_detail.status_code == 200
    line_labels = {ln["label"] for ln in p4_detail.json()["lines"]}
    assert "Trip" in line_labels


async def test_refresh_unpaid_invoices_after_structure_change(client, admin_headers):
    headers, _ = await _finance_headers(client, admin_headers, "FIN5")
    p4_class = await _create_class_level(client, headers, "P4", "Primary Four")
    p4_student = await _enroll_student(client, headers, p4_class, residence="boarder")

    await _setup_structure(
        client,
        headers,
        extra_lines=[
            {"label": "Fees", "amount_ugx": 900_000, "applies_to": "boarder"},
        ],
    )
    await client.post("/api/v1/tenant/finance/invoices/generate", headers=headers)

    # New structure with the P4 trip levy; activating archives the first one.
    created = await client.post(
        "/api/v1/tenant/finance/structures",
        json={"name": "Term fees with trip"},
        headers=headers,
    )
    structure_id = created.json()["id"]
    for line in [
        {"label": "Fees", "amount_ugx": 900_000, "applies_to": "boarder"},
        {"label": "Trip", "amount_ugx": 50_000, "applies_to": "class_level", "class_level": "P4"},
    ]:
        await client.post(
            f"/api/v1/tenant/finance/structures/{structure_id}/lines",
            json=line,
            headers=headers,
        )
    await client.post(f"/api/v1/tenant/finance/structures/{structure_id}/activate", headers=headers)

    refresh = await client.post(
        "/api/v1/tenant/finance/invoices/generate?refresh_unpaid=true",
        headers=headers,
    )
    assert refresh.status_code == 200, refresh.text
    body = refresh.json()
    assert body["created"] == 0
    assert body["refreshed"] == 1

    invoices = await client.get("/api/v1/tenant/finance/invoices", headers=headers)
    row = next(i for i in invoices.json() if i["student_id"] == p4_student)
    assert row["total_ugx"] == 950_000


async def test_finance_summary_class_filter_and_expected_totals(client, admin_headers):
    headers, _ = await _finance_headers(client, admin_headers, "FIN6")
    baby_class = await _create_class_level(client, headers, "BABY", "Baby Class")
    p5_class = await _create_class_level(client, headers, "P5", "Primary Five")
    await _enroll_student(client, headers, baby_class, residence="day")
    await _enroll_student(client, headers, p5_class, residence="day")

    structure = await _setup_structure(
        client,
        headers,
        extra_lines=[
            {"label": "Tuition", "amount_ugx": 300_000, "applies_to": "all"},
            {"label": "Nursery kit", "amount_ugx": 50_000, "applies_to": "class_level", "class_level": "BABY"},
        ],
    )
    assert structure["expected_invoiced_ugx"] == 650_000
    assert structure["level_amounts_ugx"]["BABY"] == 350_000
    assert structure["level_amounts_ugx"]["P5"] == 300_000

    await client.post("/api/v1/tenant/finance/invoices/generate", headers=headers)

    term_summary = await client.get("/api/v1/tenant/finance/summary", headers=headers)
    assert term_summary.status_code == 200
    assert term_summary.json()["expected_invoiced_ugx"] == 650_000
    assert term_summary.json()["total_invoiced_ugx"] == 650_000

    class_summary = await client.get(
        f"/api/v1/tenant/finance/summary?class_id={baby_class}",
        headers=headers,
    )
    assert class_summary.status_code == 200
    body = class_summary.json()
    assert body["registered_count"] == 1
    assert body["invoiced_count"] == 1
    assert body["total_invoiced_ugx"] == 350_000
    assert body["expected_invoiced_ugx"] == 350_000

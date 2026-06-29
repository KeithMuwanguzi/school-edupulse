"""HR & Payroll module."""
from __future__ import annotations

import pytest

from tests.conftest import onboard_and_login

pytestmark = pytest.mark.asyncio

HR_MODULES = ["core", "students", "academics", "hr_payroll"]


async def test_hr_module_gate(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "HRG1", module_keys=HR_MODULES[:-1])
    resp = await client.get("/api/v1/tenant/hr-payroll/summary", headers=headers)
    assert resp.status_code == 403


async def test_employee_profile_and_payroll_run(client, admin_headers):
    headers, onboard = await onboard_and_login(client, admin_headers, "HRG2", module_keys=HR_MODULES)
    users = await client.get("/api/v1/tenant/users", headers=headers)
    admin_user = next(u for u in users.json() if u["role_key"] == "school_admin")

    profile = await client.put(
        f"/api/v1/tenant/hr-payroll/employees/{admin_user['id']}/profile",
        json={
            "job_title": "Head Teacher",
            "department": "leadership",
            "employment_type": "permanent",
            "base_salary_ugx": 2_000_000,
            "housing_allowance_ugx": 300_000,
            "payment_method": "mobile_money",
            "mobile_money_number": "0700000000",
        },
        headers=headers,
    )
    assert profile.status_code == 200
    assert profile.json()["has_profile"] is True

    run = await client.post(
        "/api/v1/tenant/hr-payroll/payroll-runs",
        json={"year": 2026, "month": 6},
        headers=headers,
    )
    assert run.status_code == 201
    body = run.json()
    assert body["staff_count"] >= 1
    assert body["total_gross_ugx"] > 0

    finalize = await client.post(
        f"/api/v1/tenant/hr-payroll/payroll-runs/{body['id']}/finalize",
        headers=headers,
    )
    assert finalize.status_code == 200
    assert finalize.json()["status"] == "finalized"

    payslips = await client.get("/api/v1/tenant/hr-payroll/me/payslips", headers=headers)
    assert payslips.status_code == 200
    assert len(payslips.json()) >= 1


async def test_leave_request_flow(client, admin_headers):
    headers, _ = await onboard_and_login(client, admin_headers, "HRG3", module_keys=HR_MODULES)

    types = await client.get("/api/v1/tenant/hr-payroll/leave-types", headers=headers)
    assert types.status_code == 200
    leave_type_id = types.json()[0]["id"]

    create = await client.post(
        "/api/v1/tenant/hr-payroll/me/leave",
        json={
            "leave_type_id": leave_type_id,
            "starts_on": "2026-07-01",
            "ends_on": "2026-07-03",
            "reason": "Family matter",
        },
        headers=headers,
    )
    assert create.status_code == 201
    request_id = create.json()["id"]

    approve = await client.post(
        f"/api/v1/tenant/hr-payroll/leave-requests/{request_id}/approve",
        json={},
        headers=headers,
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

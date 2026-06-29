"""Uganda payroll calculations — simplified NSSF and PAYE for school staff."""
from __future__ import annotations

from dataclasses import dataclass


NSSF_EMPLOYEE_RATE = 0.05
NSSF_EMPLOYER_RATE = 0.10


@dataclass(frozen=True)
class PayrollBreakdown:
    base_salary_ugx: int
    housing_allowance_ugx: int
    transport_allowance_ugx: int
    responsibility_allowance_ugx: int
    other_allowances_ugx: int
    gross_ugx: int
    nssf_employee_ugx: int
    nssf_employer_ugx: int
    paye_ugx: int
    other_deductions_ugx: int
    net_ugx: int


def _monthly_paye_ugx(chargeable_income: int) -> int:
    """Simplified Uganda monthly PAYE bands (approximate — verify with URA for filing)."""
    if chargeable_income <= 0:
        return 0
    tax = 0
    remaining = chargeable_income
    bands = [
        (235_000, 0.0),
        (100_000, 0.10),
        (100_000, 0.20),
        (100_000, 0.30),
    ]
    for width, rate in bands:
        if remaining <= 0:
            break
        slice_amount = min(remaining, width)
        tax += int(round(slice_amount * rate))
        remaining -= slice_amount
    if remaining > 0:
        tax += int(round(remaining * 0.40))
    return max(0, tax)


def compute_payroll_line(
    *,
    base_salary_ugx: int,
    housing_allowance_ugx: int = 0,
    transport_allowance_ugx: int = 0,
    responsibility_allowance_ugx: int = 0,
    other_allowances_ugx: int = 0,
    recurring_deduction_ugx: int = 0,
) -> PayrollBreakdown:
    gross = (
        base_salary_ugx
        + housing_allowance_ugx
        + transport_allowance_ugx
        + responsibility_allowance_ugx
        + other_allowances_ugx
    )
    nssf_employee = int(round(gross * NSSF_EMPLOYEE_RATE))
    nssf_employer = int(round(gross * NSSF_EMPLOYER_RATE))
    chargeable = max(0, gross - nssf_employee)
    paye = _monthly_paye_ugx(chargeable)
    other = max(0, recurring_deduction_ugx)
    net = max(0, gross - nssf_employee - paye - other)
    return PayrollBreakdown(
        base_salary_ugx=base_salary_ugx,
        housing_allowance_ugx=housing_allowance_ugx,
        transport_allowance_ugx=transport_allowance_ugx,
        responsibility_allowance_ugx=responsibility_allowance_ugx,
        other_allowances_ugx=other_allowances_ugx,
        gross_ugx=gross,
        nssf_employee_ugx=nssf_employee,
        nssf_employer_ugx=nssf_employer,
        paye_ugx=paye,
        other_deductions_ugx=other,
        net_ugx=net,
    )

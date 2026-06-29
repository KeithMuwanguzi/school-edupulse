"""Student import row parsing — spreadsheet-friendly dates and phones."""
from __future__ import annotations

import datetime as dt

import pytest
from pydantic import ValidationError

from app.schemas.student import StudentImportRow


def _base_row(**overrides) -> dict:
    payload = {
        "first_name": "James",
        "last_name": "Okello",
        "class_level": "BABY",
        "gender": "male",
        "date_of_birth": "01/01/2023",
        "admission_date": "15/01/2026",
        "guardian_phone": "2.57E+11",
    }
    payload.update(overrides)
    return payload


def test_import_row_parses_dd_mm_yyyy_dates():
    row = StudentImportRow.model_validate(_base_row())
    assert row.date_of_birth == dt.date(2023, 1, 1)
    assert row.admission_date == dt.date(2026, 1, 15)


def test_import_row_normalizes_excel_phone_notation():
    row = StudentImportRow.model_validate(_base_row())
    assert row.guardian_phone == "257000000000"


def test_import_row_rejects_unparseable_date():
    with pytest.raises(ValidationError) as exc:
        StudentImportRow.model_validate(_base_row(date_of_birth="not-a-date"))
    messages = " ".join(str(e["msg"]) for e in exc.value.errors())
    assert "date_of_birth" in messages.lower() or "YYYY-MM-DD" in messages

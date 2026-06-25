"""Complete student enrollment payloads for API tests."""
from __future__ import annotations

import datetime as dt


def enrollment_payload(*, class_id: str, stream_id: str | None = None, **overrides) -> dict:
    payload = {
        "first_name": "Test",
        "last_name": "Learner",
        "gender": "male",
        "date_of_birth": "2015-06-01",
        "nationality": "Ugandan",
        "class_id": class_id,
        "residence": "day",
        "admission_date": str(dt.date.today()),
        "home_address": "Plot 12, Kampala Road",
        "district": "Kampala",
        "guardians": [
            {
                "relationship": "mother",
                "full_name": "Jane Guardian",
                "phone_primary": "+256700000001",
                "is_primary": True,
                "is_emergency": True,
            }
        ],
        "health": {"blood_group": "O+"},
    }
    if stream_id is not None:
        payload["stream_id"] = stream_id
    payload.update(overrides)
    return payload


def import_row_payload(*, class_level: str = "P3", **overrides) -> dict:
    """Complete row for POST /tenant/students/import."""
    payload = {
        "first_name": "Test",
        "last_name": "Learner",
        "class_level": class_level,
        "gender": "male",
        "date_of_birth": "2015-06-01",
        "nationality": "Ugandan",
        "residence": "day",
        "admission_date": str(dt.date.today()),
        "home_address": "Plot 12, Kampala Road",
        "district": "Kampala",
        "guardian_name": "Jane Guardian",
        "guardian_relationship": "mother",
        "guardian_phone": "+256700000001",
        "blood_group": "O+",
    }
    payload.update(overrides)
    return payload

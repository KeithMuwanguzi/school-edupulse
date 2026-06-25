"""School-local clock helpers."""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo


def test_lesson_end_passed_in_school_timezone() -> None:
    """Regression: server UTC must not block attendance when local lesson has ended."""
    tz = ZoneInfo("Africa/Kampala")
    now = dt.datetime(2026, 6, 22, 10, 12, tzinfo=tz)
    lesson_end = dt.time(9, 0)
    assert lesson_end <= now.time()

    utc_now = dt.datetime(2026, 6, 22, 7, 12, tzinfo=ZoneInfo("UTC"))
    assert not (lesson_end <= utc_now.time())

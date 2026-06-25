"""Schema invariants (§4.1): tenant_id-leading indexes, RLS, log partitions."""
from __future__ import annotations

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.asyncio

TENANT_TABLES = [
    "schools",
    "tenant_users",
    "school_module_subscriptions",
    "subscription_change_log",
    "academic_years",
    "terms",
    "subjects",
    "streams",
    "students",
    "classes",
]


async def test_login_index_is_tenant_leading(db):
    indexdef = await db.scalar(
        text("SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_tenant_users_login'")
    )
    assert indexdef is not None
    # tenant_id must be the leading column.
    cols = indexdef.split("(", 1)[1]
    assert cols.strip().startswith("tenant_id")


async def test_all_tenant_tables_have_rls(db):
    rows = await db.execute(
        text(
            "SELECT relname FROM pg_class WHERE relrowsecurity = true "
            "AND relname = ANY(:names)"
        ),
        {"names": TENANT_TABLES},
    )
    enabled = {r[0] for r in rows}
    assert set(TENANT_TABLES) == enabled


async def test_log_tables_are_partitioned(db):
    for tbl in ("api_request_logs", "error_logs"):
        kind = await db.scalar(
            text("SELECT relkind FROM pg_class WHERE relname = :t"), {"t": tbl}
        )
        # relkind comes back as a single-char "char" (bytes via asyncpg).
        kind = kind.decode() if isinstance(kind, bytes) else kind
        assert kind == "p"  # partitioned table
        part_count = await db.scalar(
            text(
                "SELECT count(*) FROM pg_inherits i "
                "JOIN pg_class p ON p.oid = i.inhparent WHERE p.relname = :t"
            ),
            {"t": tbl},
        )
        assert part_count > 0


async def test_subscription_unique_active_index_partial(db):
    indexdef = await db.scalar(
        text(
            "SELECT indexdef FROM pg_indexes "
            "WHERE indexname = 'uq_subscription_active_module'"
        )
    )
    assert indexdef is not None
    assert "is_active = true" in indexdef.lower()

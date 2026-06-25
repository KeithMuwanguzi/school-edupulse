"""RLS isolation at the database level (§4.1, §11).

Sets app.current_tenant_id and asserts a tenant cannot read another's rows, and
that the platform bypass GUC sees across tenants.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text

from app.core.db import apply_tenant_guc

pytestmark = pytest.mark.asyncio


async def _insert_tenant(db, code: str) -> uuid.UUID:
    tid = uuid.uuid4()
    await db.execute(
        text("INSERT INTO tenants (id, school_code, status) VALUES (:id, :code, 'active')"),
        {"id": tid, "code": code},
    )
    await db.commit()
    return tid


async def test_rls_blocks_cross_tenant_read(db):
    tenant_a = await _insert_tenant(db, "RLSA")
    tenant_b = await _insert_tenant(db, "RLSB")

    # Insert a school for tenant A under A's scope.
    async with db.begin():
        await apply_tenant_guc(db, tenant_a)
        await db.execute(
            text(
                "INSERT INTO schools (tenant_id, name, ownership) "
                "VALUES (:tid, 'Alpha Primary', 'private')"
            ),
            {"tid": tenant_a},
        )

    # Tenant B sees zero rows.
    async with db.begin():
        await apply_tenant_guc(db, tenant_b)
        count_b = await db.scalar(text("SELECT count(*) FROM schools"))
    assert count_b == 0

    # Tenant A sees its own row.
    async with db.begin():
        await apply_tenant_guc(db, tenant_a)
        count_a = await db.scalar(text("SELECT count(*) FROM schools"))
    assert count_a == 1


async def test_rls_denies_when_no_context(db):
    tenant_a = await _insert_tenant(db, "RLSC")
    async with db.begin():
        await apply_tenant_guc(db, tenant_a)
        await db.execute(
            text("INSERT INTO schools (tenant_id, name) VALUES (:tid, 'Gamma Primary')"),
            {"tid": tenant_a},
        )
    # No tenant GUC set → deny by default.
    async with db.begin():
        await apply_tenant_guc(db, None)
        count = await db.scalar(text("SELECT count(*) FROM schools"))
    assert count == 0


async def test_rls_write_check_blocks_foreign_tenant(db):
    tenant_a = await _insert_tenant(db, "RLSD")
    tenant_b = await _insert_tenant(db, "RLSE")
    # Under A's scope, attempt to insert a row owned by B → WITH CHECK violation.
    with pytest.raises(Exception):
        async with db.begin():
            await apply_tenant_guc(db, tenant_a)
            await db.execute(
                text("INSERT INTO schools (tenant_id, name) VALUES (:tid, 'Spoof')"),
                {"tid": tenant_b},
            )


async def test_platform_bypass_sees_all(db):
    tenant_a = await _insert_tenant(db, "RLSF")
    tenant_b = await _insert_tenant(db, "RLSG")
    for t, name in [(tenant_a, "A Sch"), (tenant_b, "B Sch")]:
        async with db.begin():
            await apply_tenant_guc(db, t)
            await db.execute(
                text("INSERT INTO schools (tenant_id, name) VALUES (:tid, :n)"),
                {"tid": t, "n": name},
            )
    async with db.begin():
        await db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        count = await db.scalar(text("SELECT count(*) FROM schools"))
    assert count == 2

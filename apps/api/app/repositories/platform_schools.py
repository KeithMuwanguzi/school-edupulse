"""Platform (cross-tenant) school queries (§4.1 — separate from tenant repos)."""
from __future__ import annotations

import base64
import datetime as dt
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform import Tenant
from app.models.school import School
from app.models.subscription import SchoolModuleSubscription
from app.models.user import Role, TenantUser
from app.repositories.base import PlatformRepository

MAX_PAGE = 100


def _encode_cursor(created_at: dt.datetime, tenant_id: UUID) -> str:
    raw = f"{created_at.isoformat()}|{tenant_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[dt.datetime, UUID]:
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    ts, tid = raw.split("|", 1)
    return dt.datetime.fromisoformat(ts), UUID(tid)


class PlatformSchoolRepository(PlatformRepository):
    async def list_schools(
        self,
        *,
        status: str | None = None,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[dict], str | None]:
        limit = max(1, min(limit, MAX_PAGE))
        sub_count = (
            select(func.count())
            .select_from(SchoolModuleSubscription)
            .where(
                SchoolModuleSubscription.tenant_id == Tenant.id,
                SchoolModuleSubscription.is_active.is_(True),
            )
            .correlate(Tenant)
            .scalar_subquery()
        )
        stmt = (
            select(Tenant, School, sub_count.label("module_count"))
            .join(School, School.tenant_id == Tenant.id, isouter=True)
            .where(Tenant.deleted_at.is_(None))
            .order_by(Tenant.created_at.desc(), Tenant.id.desc())
            .limit(limit + 1)
        )
        if status:
            stmt = stmt.where(Tenant.status == status)
        if cursor:
            c_ts, c_id = _decode_cursor(cursor)
            # Keyset pagination on (created_at DESC, id DESC).
            stmt = stmt.where(
                or_(
                    Tenant.created_at < c_ts,
                    and_(Tenant.created_at == c_ts, Tenant.id < c_id),
                )
            )

        rows = (await self.session.execute(stmt)).all()
        has_more = len(rows) > limit
        rows = rows[:limit]
        items = [
            {
                "tenant": t,
                "school": s,
                "module_count": int(mc or 0),
            }
            for (t, s, mc) in rows
        ]
        next_cursor = (
            _encode_cursor(items[-1]["tenant"].created_at, items[-1]["tenant"].id)
            if has_more and items
            else None
        )
        return items, next_cursor

    async def get_detail(self, tenant_id: UUID) -> tuple[Tenant, School] | None:
        row = (
            await self.session.execute(
                select(Tenant, School)
                .join(School, School.tenant_id == Tenant.id, isouter=True)
                .where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
            )
        ).first()
        if row is None:
            return None
        return row[0], row[1]

    async def get_users(self, tenant_id: UUID) -> list[tuple[TenantUser, str]]:
        rows = (
            await self.session.execute(
                select(TenantUser, Role.role_key)
                .join(Role, Role.id == TenantUser.role_id)
                .where(TenantUser.tenant_id == tenant_id, TenantUser.deleted_at.is_(None))
                .order_by(TenantUser.login_id)
            )
        ).all()
        return [(u, rk) for (u, rk) in rows]

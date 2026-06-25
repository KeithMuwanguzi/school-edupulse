"""Repository base classes (§4.1 repository contract).

TenantScopedRepository requires a TenantContext and injects tenant_id into every
query — it is never an optional parameter. PlatformRepository is for cross-tenant
platform routes and lives separately.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext


class TenantScopedRepository:
    """All methods operate within a single tenant. tenant_id comes from context."""

    def __init__(self, session: AsyncSession, ctx: TenantContext):
        self.session = session
        self.ctx = ctx
        # Raises if a platform route accidentally constructs a tenant repo.
        self.tenant_id: UUID = ctx.tenant_id

    def _scoped(self, model):
        return select(model).where(model.tenant_id == self.tenant_id)


class PlatformRepository:
    """Cross-tenant repository for /platform routes. No implicit tenant filter."""

    def __init__(self, session: AsyncSession):
        self.session = session

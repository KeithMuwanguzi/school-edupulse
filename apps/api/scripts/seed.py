"""Idempotent seed: roles, module catalog, platform config, platform admin, geo.

Safe to run on every boot — uses ON CONFLICT upserts.
Run: python -m scripts.seed
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.logging import configure_logging, get_logger
from app.core.security import hash_password
from app.core.seed_data import MODULE_CATALOG, ROLES, UGANDA_GEO
from app.models import District, ModuleCatalog, PlatformAdmin, PlatformConfig, Region, Role

configure_logging()
log = get_logger("skulpulse.seed")


async def seed_roles(session) -> None:
    for key, name, desc, is_platform in ROLES:
        stmt = (
            insert(Role)
            .values(role_key=key, name=name, description=desc, is_platform_role=is_platform)
            .on_conflict_do_update(
                index_elements=["role_key"],
                set_={"name": name, "description": desc, "is_platform_role": is_platform},
            )
        )
        await session.execute(stmt)


async def seed_modules(session) -> None:
    for order, (key, name, category, price, desc) in enumerate(MODULE_CATALOG):
        stmt = (
            insert(ModuleCatalog)
            .values(
                module_key=key,
                name=name,
                category=category,
                price_per_term_ugx=price,
                description=desc,
                is_active=True,
                sort_order=order,
            )
            .on_conflict_do_update(
                index_elements=["module_key"],
                set_={
                    "name": name,
                    "category": category,
                    "price_per_term_ugx": price,
                    "description": desc,
                    "sort_order": order,
                },
            )
        )
        await session.execute(stmt)


async def seed_platform_config(session) -> None:
    stmt = (
        insert(PlatformConfig)
        .values(
            key="platform_base_fee_ugx",
            value={"amount": settings.platform_base_fee_ugx, "currency": "UGX"},
        )
        .on_conflict_do_update(
            index_elements=["key"],
            set_={"value": {"amount": settings.platform_base_fee_ugx, "currency": "UGX"}},
        )
    )
    await session.execute(stmt)


async def seed_platform_admin(session) -> None:
    existing = await session.scalar(
        select(PlatformAdmin).where(PlatformAdmin.email == settings.platform_admin_email)
    )
    if existing:
        log.info("seed.platform_admin.exists", email=settings.platform_admin_email)
        return
    session.add(
        PlatformAdmin(
            email=settings.platform_admin_email,
            password_hash=hash_password(settings.platform_admin_password),
            name="Platform Administrator",
            is_active=True,
            must_change_password=True,
        )
    )
    log.info("seed.platform_admin.created", email=settings.platform_admin_email)


async def seed_geo(session) -> None:
    for region_name, districts in UGANDA_GEO.items():
        region = await session.scalar(select(Region).where(Region.name == region_name))
        if region is None:
            region = Region(name=region_name)
            session.add(region)
            await session.flush()
        for d in districts:
            exists = await session.scalar(
                select(District).where(District.name == d, District.region_id == region.id)
            )
            if exists is None:
                session.add(District(name=d, region_id=region.id))


async def main() -> None:
    async with SessionLocal() as session:
        async with session.begin():
            await seed_roles(session)
            await seed_modules(session)
            await seed_platform_config(session)
            await seed_platform_admin(session)
            await seed_geo(session)
    log.info("seed.complete")


if __name__ == "__main__":
    asyncio.run(main())

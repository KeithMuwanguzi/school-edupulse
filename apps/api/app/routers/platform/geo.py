"""Geography reference data for selectors (§2.2)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_platform_session
from app.models.geo import District, Region

router = APIRouter(prefix="/platform", tags=["platform:geo"])


class DistrictItem(BaseModel):
    id: UUID
    name: str
    region: str | None = None


@router.get("/districts", response_model=list[DistrictItem])
async def list_districts(
    session: AsyncSession = Depends(get_platform_session),
) -> list[DistrictItem]:
    rows = (
        await session.execute(
            select(District, Region.name)
            .join(Region, Region.id == District.region_id, isouter=True)
            .order_by(District.name)
        )
    ).all()
    return [DistrictItem(id=d.id, name=d.name, region=rname) for (d, rname) in rows]

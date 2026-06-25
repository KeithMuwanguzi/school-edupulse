"""Boarding & Hostel add-on — Phase 2 §19 (`hostel` module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.models.enums import ActorType
from app.schemas.hostel import (
    AllocateRequest,
    CheckoutRequest,
    HostelCreate,
    HostelDetailOut,
    HostelOptionOut,
    HostelOut,
    HostelRoomCreate,
    HostelRoomOut,
    HostelRoomUpdate,
    HostelUpdate,
)
from app.services import hostel_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:hostel"])

_hostel = require_module("hostel")
_read = require_role("school_admin", "deputy_head", "bursar")
_write = require_role("school_admin", "deputy_head")


# --- Hostels ---------------------------------------------------------------


@router.get("/hostels", response_model=list[HostelOut])
async def list_hostels(
    ctx: TenantContext = Depends(_read),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> list[HostelOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hostel_service.list_hostels(session, ctx.tenant_id)


@router.get("/hostels/options", response_model=list[HostelOptionOut])
async def hostel_options(
    gender: str | None = Query(default=None),
    ctx: TenantContext = Depends(_read),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> list[HostelOptionOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hostel_service.list_options(session, ctx.tenant_id, gender=gender)


@router.get("/hostels/{hostel_id}", response_model=HostelDetailOut)
async def get_hostel(
    hostel_id: UUID,
    ctx: TenantContext = Depends(_read),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> HostelDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hostel_service.get_hostel_detail(session, ctx.tenant_id, hostel_id)


@router.post("/hostels", response_model=HostelOut, status_code=201)
async def create_hostel(
    body: HostelCreate,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> HostelOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await hostel_service.create_hostel(session, ctx.tenant_id, body)
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.create",
        resource_type="hostel",
        resource_id=result.id,
        metadata={"name": result.name},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/hostels/{hostel_id}", response_model=HostelOut)
async def update_hostel(
    hostel_id: UUID,
    body: HostelUpdate,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> HostelOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await hostel_service.update_hostel(session, ctx.tenant_id, hostel_id, body)
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.update",
        resource_type="hostel",
        resource_id=hostel_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete("/hostels/{hostel_id}", status_code=204, response_class=Response)
async def delete_hostel(
    hostel_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await hostel_service.delete_hostel(session, ctx.tenant_id, hostel_id)
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.delete",
        resource_type="hostel",
        resource_id=hostel_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)


# --- Rooms -----------------------------------------------------------------


@router.post("/hostels/{hostel_id}/rooms", response_model=HostelRoomOut, status_code=201)
async def create_room(
    hostel_id: UUID,
    body: HostelRoomCreate,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> HostelRoomOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await hostel_service.create_room(session, ctx.tenant_id, hostel_id, body)
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.room.create",
        resource_type="hostel_room",
        resource_id=result.id,
        metadata={"hostel_id": str(hostel_id), "name": result.name},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch(
    "/hostels/{hostel_id}/rooms/{room_id}", response_model=HostelRoomOut
)
async def update_room(
    hostel_id: UUID,
    room_id: UUID,
    body: HostelRoomUpdate,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> HostelRoomOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await hostel_service.update_room(
        session, ctx.tenant_id, hostel_id, room_id, body
    )
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.room.update",
        resource_type="hostel_room",
        resource_id=room_id,
        metadata={"hostel_id": str(hostel_id)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete(
    "/hostels/{hostel_id}/rooms/{room_id}", status_code=204, response_class=Response
)
async def delete_room(
    hostel_id: UUID,
    room_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await hostel_service.delete_room(session, ctx.tenant_id, hostel_id, room_id)
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.room.delete",
        resource_type="hostel_room",
        resource_id=room_id,
        metadata={"hostel_id": str(hostel_id)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)


# --- Allocation ------------------------------------------------------------


@router.post("/hostels/allocate", response_model=HostelDetailOut)
async def allocate(
    body: AllocateRequest,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> HostelDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await hostel_service.allocate(session, ctx.tenant_id, body)
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.allocate",
        resource_type="student",
        resource_id=body.student_id,
        metadata={
            "hostel_id": str(body.hostel_id),
            "room_id": str(body.hostel_room_id) if body.hostel_room_id else None,
        },
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/hostels/checkout", status_code=204, response_class=Response)
async def checkout(
    body: CheckoutRequest,
    request: Request,
    ctx: TenantContext = Depends(_write),
    _mod: TenantContext = Depends(_hostel),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await hostel_service.checkout(session, ctx.tenant_id, body.student_id)
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="hostel.checkout",
        resource_type="student",
        resource_id=body.student_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)

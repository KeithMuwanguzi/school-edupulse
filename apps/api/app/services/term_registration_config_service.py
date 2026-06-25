"""Admin configuration for term registration sections & requirements."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.term_registration import RegistrationRequirement, RegistrationSection
from app.schemas.term_registration import (
    RegistrationConfigOut,
    RequirementCreate,
    RequirementOut,
    RequirementUpdate,
    SectionCreate,
    SectionOut,
    SectionReorder,
    SectionUpdate,
    _slugify,
)

DEFAULT_SECTIONS: list[dict] = [
    {
        "slug": "finance",
        "label": "Finance",
        "description": "Fees and payment verification.",
        "icon": "wallet",
        "requirements": [
            {"slug": "fees_paid", "label": "School fees paid", "field_type": "checkbox", "is_required": True},
            {"slug": "receipt_no", "label": "Receipt number", "field_type": "text", "is_required": False},
            {"slug": "payment_date", "label": "Payment date", "field_type": "date", "is_required": False},
        ],
    },
    {
        "slug": "health",
        "label": "Health",
        "description": "Medical clearance and health updates.",
        "icon": "heart",
        "requirements": [
            {"slug": "medical_form", "label": "Medical form submitted", "field_type": "checkbox", "is_required": True},
            {"slug": "allergies_updated", "label": "Allergies reviewed / updated", "field_type": "checkbox", "is_required": False},
        ],
    },
    {
        "slug": "documents",
        "label": "Documents",
        "description": "Required paperwork verification.",
        "icon": "clipboard",
        "requirements": [
            {"slug": "birth_cert", "label": "Birth certificate verified", "field_type": "checkbox", "is_required": True},
            {"slug": "report_card", "label": "Previous term report card", "field_type": "checkbox", "is_required": False},
        ],
    },
    {
        "slug": "uniform",
        "label": "Uniform & supplies",
        "description": "Uniform and material issuance.",
        "icon": "box",
        "requirements": [
            {"slug": "uniform_issued", "label": "Full uniform issued", "field_type": "checkbox", "is_required": True},
        ],
    },
]


def _requirement_out(row: RegistrationRequirement) -> RequirementOut:
    options = row.options if isinstance(row.options, list) else None
    return RequirementOut(
        id=row.id,
        section_id=row.section_id,
        slug=row.slug,
        label=row.label,
        description=row.description,
        field_type=row.field_type,
        is_required=row.is_required,
        options=options,
        sort_order=row.sort_order,
        is_active=row.is_active,
    )


def _section_out(section: RegistrationSection, requirements: list[RegistrationRequirement]) -> SectionOut:
    active_reqs = [r for r in requirements if r.is_active and r.deleted_at is None]
    active_reqs.sort(key=lambda r: r.sort_order)
    return SectionOut(
        id=section.id,
        slug=section.slug,
        label=section.label,
        description=section.description,
        icon=section.icon,
        sort_order=section.sort_order,
        is_active=section.is_active,
        requirements=[_requirement_out(r) for r in active_reqs],
    )


async def _load_sections(
    session: AsyncSession, tenant_id: UUID, *, active_only: bool = False
) -> tuple[list[RegistrationSection], dict[UUID, list[RegistrationRequirement]]]:
    stmt = select(RegistrationSection).where(
        RegistrationSection.tenant_id == tenant_id,
        RegistrationSection.deleted_at.is_(None),
    )
    if active_only:
        stmt = stmt.where(RegistrationSection.is_active.is_(True))
    sections = list(await session.scalars(stmt.order_by(RegistrationSection.sort_order)))
    if not sections:
        return [], {}

    reqs = list(
        await session.scalars(
            select(RegistrationRequirement).where(
                RegistrationRequirement.tenant_id == tenant_id,
                RegistrationRequirement.section_id.in_([s.id for s in sections]),
                RegistrationRequirement.deleted_at.is_(None),
            )
        )
    )
    by_section: dict[UUID, list[RegistrationRequirement]] = {}
    for req in reqs:
        if active_only and (not req.is_active):
            continue
        by_section.setdefault(req.section_id, []).append(req)
    return sections, by_section


async def ensure_default_config(session: AsyncSession, tenant_id: UUID) -> None:
    existing = await session.scalar(
        select(func.count())
        .select_from(RegistrationSection)
        .where(
            RegistrationSection.tenant_id == tenant_id,
            RegistrationSection.deleted_at.is_(None),
        )
    )
    if existing:
        return

    for i, spec in enumerate(DEFAULT_SECTIONS):
        section = RegistrationSection(
            tenant_id=tenant_id,
            slug=spec["slug"],
            label=spec["label"],
            description=spec.get("description"),
            icon=spec.get("icon"),
            sort_order=i,
            is_active=True,
        )
        session.add(section)
        await session.flush()
        for j, req_spec in enumerate(spec.get("requirements", [])):
            session.add(
                RegistrationRequirement(
                    tenant_id=tenant_id,
                    section_id=section.id,
                    slug=req_spec["slug"],
                    label=req_spec["label"],
                    field_type=req_spec.get("field_type", "checkbox"),
                    is_required=req_spec.get("is_required", True),
                    options=req_spec.get("options"),
                    sort_order=j,
                    is_active=True,
                )
            )
    await session.flush()


async def get_config(session: AsyncSession, tenant_id: UUID) -> RegistrationConfigOut:
    await ensure_default_config(session, tenant_id)
    sections, by_section = await _load_sections(session, tenant_id, active_only=False)
    return RegistrationConfigOut(
        sections=[_section_out(s, by_section.get(s.id, [])) for s in sections]
    )


async def get_active_config(
    session: AsyncSession, tenant_id: UUID
) -> tuple[list[SectionOut], dict[UUID, RequirementOut]]:
    await ensure_default_config(session, tenant_id)
    sections, by_section = await _load_sections(session, tenant_id, active_only=True)
    section_outs = [_section_out(s, by_section.get(s.id, [])) for s in sections]
    req_map: dict[UUID, RequirementOut] = {}
    for sec in section_outs:
        for req in sec.requirements:
            req_map[req.id] = req
    return section_outs, req_map


async def create_section(
    session: AsyncSession, tenant_id: UUID, body: SectionCreate
) -> SectionOut:
    slug = body.slug or _slugify(body.label)
    clash = await session.scalar(
        select(RegistrationSection.id).where(
            RegistrationSection.tenant_id == tenant_id,
            RegistrationSection.slug == slug,
            RegistrationSection.deleted_at.is_(None),
        )
    )
    if clash:
        raise ConflictError(f"A section with slug '{slug}' already exists.")

    max_order = await session.scalar(
        select(func.coalesce(func.max(RegistrationSection.sort_order), -1)).where(
            RegistrationSection.tenant_id == tenant_id,
            RegistrationSection.deleted_at.is_(None),
        )
    )
    row = RegistrationSection(
        tenant_id=tenant_id,
        slug=slug,
        label=body.label.strip(),
        description=body.description,
        icon=body.icon,
        sort_order=body.sort_order if body.sort_order is not None else int(max_order) + 1,
        is_active=True,
    )
    session.add(row)
    await session.flush()
    return _section_out(row, [])


async def update_section(
    session: AsyncSession, tenant_id: UUID, section_id: UUID, body: SectionUpdate
) -> SectionOut:
    section = await session.scalar(
        select(RegistrationSection).where(
            RegistrationSection.tenant_id == tenant_id,
            RegistrationSection.id == section_id,
            RegistrationSection.deleted_at.is_(None),
        )
    )
    if section is None:
        raise NotFoundError("Registration section not found.")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(section, field, value)
    await session.flush()

    reqs = list(
        await session.scalars(
            select(RegistrationRequirement).where(
                RegistrationRequirement.tenant_id == tenant_id,
                RegistrationRequirement.section_id == section_id,
                RegistrationRequirement.deleted_at.is_(None),
            )
        )
    )
    return _section_out(section, reqs)


async def delete_section(session: AsyncSession, tenant_id: UUID, section_id: UUID) -> None:
    section = await session.scalar(
        select(RegistrationSection).where(
            RegistrationSection.tenant_id == tenant_id,
            RegistrationSection.id == section_id,
            RegistrationSection.deleted_at.is_(None),
        )
    )
    if section is None:
        raise NotFoundError("Registration section not found.")
    section.deleted_at = dt.datetime.now(dt.UTC)
    await session.flush()


async def reorder_sections(
    session: AsyncSession, tenant_id: UUID, body: SectionReorder
) -> RegistrationConfigOut:
    sections = list(
        await session.scalars(
            select(RegistrationSection).where(
                RegistrationSection.tenant_id == tenant_id,
                RegistrationSection.deleted_at.is_(None),
            )
        )
    )
    by_id = {s.id: s for s in sections}
    for i, sid in enumerate(body.section_ids):
        if sid not in by_id:
            raise ValidationError("One or more section IDs are invalid.")
        by_id[sid].sort_order = i
    await session.flush()
    return await get_config(session, tenant_id)


async def create_requirement(
    session: AsyncSession, tenant_id: UUID, section_id: UUID, body: RequirementCreate
) -> RequirementOut:
    section = await session.scalar(
        select(RegistrationSection).where(
            RegistrationSection.tenant_id == tenant_id,
            RegistrationSection.id == section_id,
            RegistrationSection.deleted_at.is_(None),
        )
    )
    if section is None:
        raise NotFoundError("Registration section not found.")

    slug = body.slug or _slugify(body.label)
    clash = await session.scalar(
        select(RegistrationRequirement.id).where(
            RegistrationRequirement.tenant_id == tenant_id,
            RegistrationRequirement.section_id == section_id,
            RegistrationRequirement.slug == slug,
            RegistrationRequirement.deleted_at.is_(None),
        )
    )
    if clash:
        raise ConflictError(f"A requirement with slug '{slug}' already exists in this section.")

    if body.field_type == "select" and not body.options:
        raise ValidationError("Select fields require at least one option.")

    max_order = await session.scalar(
        select(func.coalesce(func.max(RegistrationRequirement.sort_order), -1)).where(
            RegistrationRequirement.tenant_id == tenant_id,
            RegistrationRequirement.section_id == section_id,
            RegistrationRequirement.deleted_at.is_(None),
        )
    )
    row = RegistrationRequirement(
        tenant_id=tenant_id,
        section_id=section_id,
        slug=slug,
        label=body.label.strip(),
        description=body.description,
        field_type=body.field_type,
        is_required=body.is_required,
        options=body.options,
        sort_order=body.sort_order if body.sort_order is not None else int(max_order) + 1,
        is_active=True,
    )
    session.add(row)
    await session.flush()
    return _requirement_out(row)


async def update_requirement(
    session: AsyncSession, tenant_id: UUID, requirement_id: UUID, body: RequirementUpdate
) -> RequirementOut:
    row = await session.scalar(
        select(RegistrationRequirement).where(
            RegistrationRequirement.tenant_id == tenant_id,
            RegistrationRequirement.id == requirement_id,
            RegistrationRequirement.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Registration requirement not found.")

    changes = body.model_dump(exclude_none=True)
    if changes.get("field_type") == "select" and body.options is not None and not body.options:
        raise ValidationError("Select fields require at least one option.")
    for field, value in changes.items():
        setattr(row, field, value)
    await session.flush()
    return _requirement_out(row)


async def delete_requirement(
    session: AsyncSession, tenant_id: UUID, requirement_id: UUID
) -> None:
    row = await session.scalar(
        select(RegistrationRequirement).where(
            RegistrationRequirement.tenant_id == tenant_id,
            RegistrationRequirement.id == requirement_id,
            RegistrationRequirement.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Registration requirement not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)
    await session.flush()

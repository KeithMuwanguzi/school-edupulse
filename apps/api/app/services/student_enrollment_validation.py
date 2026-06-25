"""Enrollment completeness rules — required before a learner is onboarded."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.models.school_class import ClassStream
from app.schemas.student import StudentCreate


def _is_ugandan(nationality: str | None) -> bool:
    if not nationality:
        return False
    return nationality.strip().lower() in {"ugandan", "uganda"}


def validate_student_enrollment(
    body: StudentCreate,
    *,
    class_has_streams: bool = False,
) -> None:
    """Ensure term-critical profile data is captured at onboarding."""
    errors: list[str] = []

    if not body.gender:
        errors.append("gender is required")
    if body.date_of_birth is None:
        errors.append("date_of_birth is required")
    if not body.nationality or not body.nationality.strip():
        errors.append("nationality is required")
    if body.class_id is None:
        errors.append("class_id is required")
    if not body.residence:
        errors.append("residence is required")
    if body.admission_date is None:
        errors.append("admission_date is required")

    has_home = bool(body.home_address and body.home_address.strip())
    has_village = bool(body.village and body.village.strip())
    if not has_home and not has_village:
        errors.append("home_address or village is required")

    if _is_ugandan(body.nationality) and not (body.district and body.district.strip()):
        errors.append("district is required for Ugandan nationals")

    if class_has_streams and body.stream_id is None:
        errors.append("stream_id is required for this class")

    if not body.guardians:
        errors.append("at least one guardian is required")
    else:
        primaries = [g for g in body.guardians if g.is_primary]
        if not primaries:
            errors.append("one guardian must be marked primary")
        elif not primaries[0].full_name.strip():
            errors.append("primary guardian full_name is required")
        elif not primaries[0].phone_primary or not primaries[0].phone_primary.strip():
            errors.append("primary guardian phone is required")
        for idx, guardian in enumerate(body.guardians, start=1):
            if not guardian.full_name.strip():
                errors.append(f"guardian {idx}: full_name is required")

    if body.health is None:
        errors.append("health profile is required")
    elif not body.health.blood_group or not body.health.blood_group.strip():
        errors.append("blood_group is required")

    if errors:
        raise ValidationError(" ".join(errors))


async def class_has_active_streams(
    session: AsyncSession,
    tenant_id: UUID,
    class_id: UUID,
) -> bool:
    count = await session.scalar(
        select(func.count())
        .select_from(ClassStream)
        .where(
            ClassStream.tenant_id == tenant_id,
            ClassStream.class_id == class_id,
            ClassStream.is_active.is_(True),
            ClassStream.deleted_at.is_(None),
        )
    )
    return int(count or 0) > 0

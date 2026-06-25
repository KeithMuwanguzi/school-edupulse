"""Platform system maintenance (destructive ops gated by config)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.dependencies import Principal, require_platform_admin
from app.core.errors import ForbiddenError, ValidationError
from app.schemas.platform_system import PlatformDataResetRequest, PlatformDataResetResponse
from app.services.platform_reset_service import RESET_CONFIRMATION_PHRASE, reset_platform_data

router = APIRouter(prefix="/platform/system", tags=["platform:system"])


@router.post("/reset-data", response_model=PlatformDataResetResponse)
async def reset_data(
    body: PlatformDataResetRequest,
    _: Principal = Depends(require_platform_admin),
) -> PlatformDataResetResponse:
    if not settings.platform_allow_data_reset:
        raise ForbiddenError(
            "Platform data reset is disabled. Set PLATFORM_ALLOW_DATA_RESET=true to enable."
        )
    if body.confirmation != RESET_CONFIRMATION_PHRASE:
        raise ValidationError(
            detail=f'Confirmation must be exactly "{RESET_CONFIRMATION_PHRASE}".',
            extra={"field": "confirmation"},
        )

    result = await reset_platform_data()
    return PlatformDataResetResponse(
        platform_admins_preserved=int(result["platform_admins_preserved"]),
        tables_truncated=int(result["tables_truncated"]),
    )

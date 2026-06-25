"""Platform system maintenance schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.services.platform_reset_service import RESET_CONFIRMATION_PHRASE


class PlatformDataResetRequest(BaseModel):
    confirmation: str = Field(
        ...,
        description=f'Must be exactly "{RESET_CONFIRMATION_PHRASE}" to proceed.',
    )


class PlatformDataResetResponse(BaseModel):
    platform_admins_preserved: int
    tables_truncated: int

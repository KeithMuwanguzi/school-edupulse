"""Platform admin lifecycle fields — soft delete, forced password change.

Revision ID: 0035
Revises: 0034
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE platform_admins
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE platform_admins
        DROP COLUMN IF EXISTS last_login_at,
        DROP COLUMN IF EXISTS must_change_password,
        DROP COLUMN IF EXISTS deleted_at
        """
    )

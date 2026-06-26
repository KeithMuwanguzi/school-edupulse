"""Add must_change_password to tenant_users."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.alter_column("tenant_users", "must_change_password", server_default=None)


def downgrade() -> None:
    op.drop_column("tenant_users", "must_change_password")

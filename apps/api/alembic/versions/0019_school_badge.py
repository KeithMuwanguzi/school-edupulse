"""School badge URL for portal and report card branding."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "schools",
        sa.Column("badge_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("schools", "badge_url")

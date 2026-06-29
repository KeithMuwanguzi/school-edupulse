"""Parent circulars — school announcements to parents.

Revision ID: 0038
Revises: 0037
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (
            current_setting('app.bypass_rls', true) = 'on'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.bypass_rls', true) = 'on'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        """
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO skulpulse_app")


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE circular_status AS ENUM ('draft', 'published', 'archived')
        """
    )
    op.execute(
        """
        CREATE TYPE circular_audience AS ENUM ('all_parents', 'class', 'stream')
        """
    )
    op.execute(
        """
        CREATE TYPE circular_priority AS ENUM ('normal', 'important')
        """
    )
    op.execute(
        """
        CREATE TABLE circulars (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            status circular_status NOT NULL DEFAULT 'draft',
            audience circular_audience NOT NULL DEFAULT 'all_parents',
            priority circular_priority NOT NULL DEFAULT 'normal',
            class_id UUID NULL REFERENCES classes(id),
            stream_id UUID NULL REFERENCES streams(id),
            published_at TIMESTAMPTZ NULL,
            published_by UUID NULL REFERENCES tenant_users(id),
            attachment_filename VARCHAR(255) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        """
        CREATE INDEX ix_circulars_tenant_status_published
        ON circulars (tenant_id, status, published_at DESC)
        WHERE deleted_at IS NULL
        """
    )
    _enable_rls("circulars")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS circulars")
    op.execute("DROP TYPE IF EXISTS circular_priority")
    op.execute("DROP TYPE IF EXISTS circular_audience")
    op.execute("DROP TYPE IF EXISTS circular_status")

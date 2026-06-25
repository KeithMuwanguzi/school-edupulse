"""Phase 2 §3 — P1–P7 classes and optional streams.

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE class_level AS ENUM ('P1','P2','P3','P4','P5','P6','P7')"
    )
    op.execute(
        """
        CREATE TABLE classes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            level class_level NOT NULL,
            label VARCHAR(120) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            UNIQUE (tenant_id, id)
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_classes_level ON classes (tenant_id, level) "
        "WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX idx_classes_tenant_active ON classes (tenant_id, is_active) "
        "WHERE deleted_at IS NULL"
    )

    op.execute(
        """
        CREATE TABLE streams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            class_id UUID NOT NULL,
            name VARCHAR(20) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            FOREIGN KEY (tenant_id, class_id) REFERENCES classes (tenant_id, id),
            UNIQUE (tenant_id, id)
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_streams_name ON streams (tenant_id, class_id, name) "
        "WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX idx_streams_class ON streams (tenant_id, class_id) "
        "WHERE deleted_at IS NULL"
    )

    for table in ("classes", "streams"):
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


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS streams CASCADE")
    op.execute("DROP TABLE IF EXISTS classes CASCADE")
    op.execute("DROP TYPE IF EXISTS class_level")

"""Boarding & Hostel add-on — Phase 2 §19.

Revision ID: 0028
Revises: 0027
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
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
        CREATE TABLE hostels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            name VARCHAR(120) NOT NULL,
            code VARCHAR(20) NULL,
            gender VARCHAR(10) NOT NULL DEFAULT 'mixed',
            capacity INTEGER NULL,
            warden_user_id UUID NULL,
            location VARCHAR(160) NULL,
            notes TEXT NULL,
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
        "CREATE UNIQUE INDEX uq_hostels_tenant_code "
        "ON hostels (tenant_id, lower(code)) "
        "WHERE code IS NOT NULL AND deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX idx_hostels_tenant_active "
        "ON hostels (tenant_id, sort_order) "
        "WHERE deleted_at IS NULL"
    )

    op.execute(
        """
        CREATE TABLE hostel_rooms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            hostel_id UUID NOT NULL,
            name VARCHAR(60) NOT NULL,
            capacity INTEGER NOT NULL DEFAULT 0,
            floor VARCHAR(40) NULL,
            notes TEXT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            UNIQUE (tenant_id, id),
            FOREIGN KEY (tenant_id, hostel_id)
                REFERENCES hostels (tenant_id, id)
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_hostel_rooms_tenant_hostel "
        "ON hostel_rooms (tenant_id, hostel_id, sort_order) "
        "WHERE deleted_at IS NULL"
    )

    # Allocation pointers on the learner row.
    op.execute("ALTER TABLE students ADD COLUMN hostel_id UUID NULL")
    op.execute("ALTER TABLE students ADD COLUMN hostel_room_id UUID NULL")
    op.execute(
        """
        ALTER TABLE students
        ADD CONSTRAINT fk_students_hostel
            FOREIGN KEY (tenant_id, hostel_id)
            REFERENCES hostels (tenant_id, id)
        """
    )
    op.execute(
        """
        ALTER TABLE students
        ADD CONSTRAINT fk_students_hostel_room
            FOREIGN KEY (tenant_id, hostel_room_id)
            REFERENCES hostel_rooms (tenant_id, id)
        """
    )
    op.execute(
        "CREATE INDEX idx_students_hostel "
        "ON students (tenant_id, hostel_id) "
        "WHERE hostel_id IS NOT NULL AND deleted_at IS NULL"
    )

    _enable_rls("hostels")
    _enable_rls("hostel_rooms")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_students_hostel")
    op.execute("ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_hostel_room")
    op.execute("ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_hostel")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS hostel_room_id")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS hostel_id")
    op.execute("DROP TABLE IF EXISTS hostel_rooms")
    op.execute("DROP TABLE IF EXISTS hostels")

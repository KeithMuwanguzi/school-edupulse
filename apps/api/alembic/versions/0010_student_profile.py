"""Rich student profile — demographics, guardians, health, discipline.

Revision ID: 0010
Revises: 0009
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
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
    # --- Expanded student columns -----------------------------------------
    op.execute(
        """
        ALTER TABLE students
            ADD COLUMN middle_name VARCHAR(120) NULL,
            ADD COLUMN preferred_name VARCHAR(120) NULL,
            ADD COLUMN nationality VARCHAR(60) NULL,
            ADD COLUMN religion VARCHAR(60) NULL,
            ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'enrolled',
            ADD COLUMN residence VARCHAR(20) NULL,
            ADD COLUMN house VARCHAR(60) NULL,
            ADD COLUMN admission_date DATE NULL,
            ADD COLUMN previous_school VARCHAR(160) NULL,
            ADD COLUMN home_address VARCHAR(255) NULL,
            ADD COLUMN village VARCHAR(120) NULL,
            ADD COLUMN district VARCHAR(120) NULL,
            ADD COLUMN photo_url VARCHAR(500) NULL
        """
    )

    # --- Guardians (1 → many) ---------------------------------------------
    op.execute(
        """
        CREATE TABLE student_guardians (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            relationship VARCHAR(30) NOT NULL,
            full_name VARCHAR(160) NOT NULL,
            phone_primary VARCHAR(30) NULL,
            phone_alt VARCHAR(30) NULL,
            email VARCHAR(255) NULL,
            occupation VARCHAR(120) NULL,
            national_id VARCHAR(40) NULL,
            address VARCHAR(255) NULL,
            is_primary BOOLEAN NOT NULL DEFAULT false,
            is_emergency BOOLEAN NOT NULL DEFAULT false,
            can_pickup BOOLEAN NOT NULL DEFAULT true,
            portal_user_id UUID NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id),
            FOREIGN KEY (tenant_id, portal_user_id) REFERENCES tenant_users (tenant_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_guardian_student
        ON student_guardians (tenant_id, student_id)
        WHERE deleted_at IS NULL
        """
    )
    _enable_rls("student_guardians")

    # --- Health (1 → 1) ----------------------------------------------------
    op.execute(
        """
        CREATE TABLE student_health (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            blood_group VARCHAR(5) NULL,
            allergies TEXT NULL,
            chronic_conditions TEXT NULL,
            medications TEXT NULL,
            disabilities TEXT NULL,
            dietary_needs VARCHAR(255) NULL,
            doctor_name VARCHAR(120) NULL,
            doctor_phone VARCHAR(30) NULL,
            insurance_provider VARCHAR(120) NULL,
            insurance_number VARCHAR(60) NULL,
            emergency_notes TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            CONSTRAINT uq_student_health_student UNIQUE (tenant_id, student_id),
            FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id)
        )
        """
    )
    _enable_rls("student_health")

    # --- Discipline incidents (1 → many) ----------------------------------
    op.execute(
        """
        CREATE TABLE student_discipline_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            incident_date DATE NOT NULL,
            category VARCHAR(40) NOT NULL,
            severity VARCHAR(20) NULL,
            description TEXT NOT NULL,
            action_taken TEXT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            recorded_by_user_id UUID NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_discipline_student
        ON student_discipline_records (tenant_id, student_id, incident_date)
        WHERE deleted_at IS NULL
        """
    )
    _enable_rls("student_discipline_records")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS student_discipline_records CASCADE")
    op.execute("DROP TABLE IF EXISTS student_health CASCADE")
    op.execute("DROP TABLE IF EXISTS student_guardians CASCADE")
    op.execute(
        """
        ALTER TABLE students
            DROP COLUMN IF EXISTS middle_name,
            DROP COLUMN IF EXISTS preferred_name,
            DROP COLUMN IF EXISTS nationality,
            DROP COLUMN IF EXISTS religion,
            DROP COLUMN IF EXISTS status,
            DROP COLUMN IF EXISTS residence,
            DROP COLUMN IF EXISTS house,
            DROP COLUMN IF EXISTS admission_date,
            DROP COLUMN IF EXISTS previous_school,
            DROP COLUMN IF EXISTS home_address,
            DROP COLUMN IF EXISTS village,
            DROP COLUMN IF EXISTS district,
            DROP COLUMN IF EXISTS photo_url
        """
    )

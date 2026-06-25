"""Initial Phase 1 schema: platform + tenant tables, RLS, indexes, partitions.

Per §4.1/§5: every tenant table ships with tenant_id-leading indexes and an RLS
policy in this same migration. Log tables are RANGE-partitioned by month.

RLS model
---------
The app connects as the table owner, so tables use FORCE ROW LEVEL SECURITY.
Two custom GUCs drive isolation (set via SET LOCAL inside each request txn):
  * app.current_tenant_id  — tenant scope for tenant routes
  * app.bypass_rls = 'on'  — platform routes only (cross-tenant reads)
The policy matches no rows when neither is set (deny by default).

Revision ID: 0001
Revises:
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TENANT_TABLES = [
    "schools",
    "tenant_users",
    "school_module_subscriptions",
    "subscription_change_log",
    "academic_years",
    "terms",
]


def upgrade() -> None:
    # --- Extensions -----------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # Dedicated NON-superuser application role. RLS is bypassed by superusers and
    # table owners, so the app must connect as this role for isolation to apply.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'skulpulse_app') THEN
                CREATE ROLE skulpulse_app LOGIN PASSWORD 'skulpulse_app'
                    NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
            END IF;
        END $$;
        """
    )
    # API role query discipline (§4.1). Set at role level — not as a connection
    # startup parameter, which PgBouncer (transaction mode) rejects.
    op.execute("ALTER ROLE skulpulse_app SET statement_timeout = '30s'")

    # --- Enum types -----------------------------------------------------
    op.execute("CREATE TYPE tenant_status AS ENUM ('trial','active','suspended','inactive')")
    op.execute("CREATE TYPE ownership AS ENUM ('government','private','government_aided')")
    op.execute(
        "CREATE TYPE registration_status AS ENUM "
        "('pending','licensed','registered','unknown')"
    )
    op.execute("CREATE TYPE boarding_status AS ENUM ('day','boarding','mixed')")
    op.execute("CREATE TYPE sex_composition AS ENUM ('boys','girls','mixed')")
    op.execute("CREATE TYPE user_status AS ENUM ('active','invited','disabled')")
    op.execute("CREATE TYPE user_type AS ENUM ('platform_admin','tenant_user')")
    op.execute("CREATE TYPE academic_year_status AS ENUM ('upcoming','active','archived')")
    op.execute("CREATE TYPE term_status AS ENUM ('upcoming','active','closed')")
    op.execute("CREATE TYPE subscription_action AS ENUM ('activated','deactivated')")
    op.execute(
        "CREATE TYPE actor_type AS ENUM "
        "('platform_admin','tenant_user','anonymous','system')"
    )

    # --- Platform tables ------------------------------------------------
    op.execute(
        """
        CREATE TABLE tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_code VARCHAR(8) NOT NULL UNIQUE,
            status tenant_status NOT NULL DEFAULT 'trial',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_tenants_status_created ON tenants (status, created_at DESC) "
        "WHERE deleted_at IS NULL"
    )

    op.execute(
        """
        CREATE TABLE platform_admins (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE module_catalog (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            module_key VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            description VARCHAR(500) NULL,
            category VARCHAR(50) NOT NULL,
            price_per_term_ugx INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0
        )
        """
    )

    op.execute(
        """
        CREATE TABLE platform_config (
            key VARCHAR(100) PRIMARY KEY,
            value JSONB NOT NULL
        )
        """
    )

    # --- Geo hierarchy --------------------------------------------------
    op.execute(
        """
        CREATE TABLE regions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(64) NOT NULL UNIQUE
        )
        """
    )
    op.execute(
        """
        CREATE TABLE districts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            region_id UUID NULL REFERENCES regions(id),
            name VARCHAR(120) NOT NULL,
            code VARCHAR(16) NULL
        )
        """
    )
    op.execute("CREATE INDEX idx_districts_region ON districts (region_id)")
    op.execute(
        """
        CREATE TABLE counties (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            district_id UUID NOT NULL REFERENCES districts(id),
            name VARCHAR(120) NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE sub_counties (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            county_id UUID NOT NULL REFERENCES counties(id),
            name VARCHAR(120) NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE parishes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sub_county_id UUID NOT NULL REFERENCES sub_counties(id),
            name VARCHAR(120) NOT NULL
        )
        """
    )

    op.execute(
        """
        CREATE TABLE roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            role_key VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            description VARCHAR(255) NULL,
            is_platform_role BOOLEAN NOT NULL DEFAULT false
        )
        """
    )

    # --- School profile (tenant) ---------------------------------------
    op.execute(
        """
        CREATE TABLE schools (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),
            name VARCHAR(255) NOT NULL,
            motto TEXT NULL,
            ownership ownership NOT NULL DEFAULT 'private',
            emis_number VARCHAR(32) NULL UNIQUE,
            license_number VARCHAR(64) NULL,
            registration_status registration_status NOT NULL DEFAULT 'unknown',
            boarding_status boarding_status NOT NULL DEFAULT 'day',
            sex_composition sex_composition NOT NULL DEFAULT 'mixed',
            is_upe BOOLEAN NOT NULL DEFAULT false,
            district_id UUID NULL REFERENCES districts(id),
            county_id UUID NULL REFERENCES counties(id),
            sub_county_id UUID NULL REFERENCES sub_counties(id),
            parish_id UUID NULL REFERENCES parishes(id),
            address_line TEXT NULL,
            phone VARCHAR(20) NULL,
            email VARCHAR(255) NULL,
            head_teacher_name VARCHAR(255) NULL,
            contact_person_name VARCHAR(255) NULL,
            contact_person_phone VARCHAR(20) NULL,
            contact_person_nin VARCHAR(20) NULL,
            timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Kampala',
            currency VARCHAR(3) NOT NULL DEFAULT 'UGX',
            locale VARCHAR(10) NOT NULL DEFAULT 'en-UG',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )

    # --- Users & auth ---------------------------------------------------
    op.execute(
        """
        CREATE TABLE tenant_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            role_id UUID NOT NULL REFERENCES roles(id),
            login_id VARCHAR(20) NOT NULL,
            email VARCHAR(255) NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            status user_status NOT NULL DEFAULT 'active',
            last_login_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_tenant_users_login ON tenant_users (tenant_id, login_id) "
        "WHERE deleted_at IS NULL"
    )

    op.execute(
        """
        CREATE TABLE refresh_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_type user_type NOT NULL,
            user_id UUID NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ NULL,
            replaced_by UUID NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_refresh_user ON refresh_tokens (user_type, user_id)")
    op.execute("CREATE UNIQUE INDEX uq_refresh_token_hash ON refresh_tokens (token_hash)")

    # --- Academic calendar ---------------------------------------------
    op.execute(
        """
        CREATE TABLE academic_years (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            label VARCHAR(4) NOT NULL,
            status academic_year_status NOT NULL DEFAULT 'active',
            starts_on DATE NULL,
            ends_on DATE NULL,
            CONSTRAINT uq_academic_year_label UNIQUE (tenant_id, label)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE terms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            academic_year_id UUID NOT NULL REFERENCES academic_years(id),
            term_number SMALLINT NOT NULL CHECK (term_number BETWEEN 1 AND 3),
            label VARCHAR(20) NOT NULL,
            starts_on DATE NULL,
            ends_on DATE NULL,
            status term_status NOT NULL DEFAULT 'upcoming',
            CONSTRAINT uq_term_number UNIQUE (tenant_id, academic_year_id, term_number)
        )
        """
    )
    op.execute("CREATE INDEX idx_terms_year_active ON terms (tenant_id, academic_year_id, status)")
    op.execute("CREATE INDEX idx_terms_status ON terms (tenant_id, status)")

    # --- Module subscriptions ------------------------------------------
    op.execute(
        """
        CREATE TABLE school_module_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            module_id UUID NOT NULL REFERENCES module_catalog(id),
            academic_year_id UUID NULL REFERENCES academic_years(id),
            term_id UUID NULL REFERENCES terms(id),
            is_active BOOLEAN NOT NULL DEFAULT true,
            activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deactivated_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_subscriptions_tenant_active "
        "ON school_module_subscriptions (tenant_id, is_active) WHERE is_active = true"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_subscription_active_module "
        "ON school_module_subscriptions (tenant_id, module_id) WHERE is_active = true"
    )

    op.execute(
        """
        CREATE TABLE subscription_change_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            module_id UUID NOT NULL REFERENCES module_catalog(id),
            action subscription_action NOT NULL,
            actor_id UUID NULL,
            idempotency_key VARCHAR(64) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_sub_changelog_tenant ON subscription_change_log "
        "(tenant_id, created_at DESC)"
    )

    # --- Audit log (append-only, platform layer) -----------------------
    op.execute(
        """
        CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            actor_type actor_type NOT NULL,
            actor_id UUID NULL,
            tenant_id UUID NULL,
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(100) NULL,
            resource_id UUID NULL,
            request_id VARCHAR(36) NULL,
            metadata JSONB NULL,
            ip_address INET NULL,
            user_agent VARCHAR(512) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_audit_tenant_time ON audit_logs (tenant_id, created_at DESC)")
    op.execute("CREATE INDEX idx_audit_request ON audit_logs (request_id)")

    # --- Idempotency ----------------------------------------------------
    op.execute(
        """
        CREATE TABLE idempotency_records (
            key VARCHAR(64) PRIMARY KEY,
            endpoint VARCHAR(255) NOT NULL,
            request_hash VARCHAR(64) NOT NULL,
            response_status SMALLINT NOT NULL,
            response_body JSONB NULL,
            tenant_id UUID NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX idx_idempotency_expires ON idempotency_records (expires_at)")

    # --- Partitioned log tables (§4.1, §5.6) ---------------------------
    op.execute(
        """
        CREATE TABLE api_request_logs (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            request_id VARCHAR(36) NOT NULL,
            method VARCHAR(10) NOT NULL,
            path VARCHAR(512) NOT NULL,
            query_string TEXT NULL,
            status_code SMALLINT NOT NULL,
            duration_ms INTEGER NOT NULL,
            tenant_id UUID NULL,
            actor_type VARCHAR(32) NOT NULL,
            actor_id UUID NULL,
            ip_address INET NULL,
            user_agent TEXT NULL,
            idempotency_key VARCHAR(64) NULL,
            request_body_hash VARCHAR(64) NULL,
            response_body_hash VARCHAR(64) NULL,
            error_code VARCHAR(64) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at)
        """
    )
    op.execute(
        "CREATE INDEX idx_request_logs_tenant_time ON api_request_logs "
        "(tenant_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX idx_request_logs_status_time ON api_request_logs "
        "(status_code, created_at DESC)"
    )
    op.execute("CREATE INDEX idx_request_logs_request_id ON api_request_logs (request_id)")

    op.execute(
        """
        CREATE TABLE error_logs (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            request_id VARCHAR(36) NOT NULL,
            level VARCHAR(16) NOT NULL,
            error_type VARCHAR(255) NULL,
            error_code VARCHAR(64) NULL,
            message TEXT NOT NULL,
            stack_trace TEXT NULL,
            endpoint VARCHAR(512) NULL,
            tenant_id UUID NULL,
            actor_id UUID NULL,
            context JSONB NULL,
            resolved_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at)
        """
    )
    op.execute("CREATE INDEX idx_error_logs_request_id ON error_logs (request_id)")
    op.execute("CREATE INDEX idx_error_logs_tenant_time ON error_logs (tenant_id, created_at DESC)")
    op.execute(
        "CREATE INDEX idx_error_logs_unresolved ON error_logs (created_at DESC) "
        "WHERE resolved_at IS NULL"
    )

    # Monthly partitions: 2025-01 .. 2027-01 + a DEFAULT catch-all per table.
    op.execute(
        """
        DO $$
        DECLARE
            d DATE := DATE '2025-01-01';
            nxt DATE;
            pname TEXT;
            tbl TEXT;
        BEGIN
            FOREACH tbl IN ARRAY ARRAY['api_request_logs','error_logs'] LOOP
                d := DATE '2025-01-01';
                WHILE d < DATE '2027-01-01' LOOP
                    nxt := (d + INTERVAL '1 month')::date;
                    pname := tbl || '_' || to_char(d, 'YYYY_MM');
                    EXECUTE format(
                        'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                        pname, tbl, d, nxt
                    );
                    d := nxt;
                END LOOP;
                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF %I DEFAULT', tbl || '_default', tbl
                );
            END LOOP;
        END $$;
        """
    )

    # Helper for Phase 1.5 automation (pg_partman replacement stub).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION create_log_partition(parent TEXT, month_start DATE)
        RETURNS void AS $$
        DECLARE
            nxt DATE := (month_start + INTERVAL '1 month')::date;
            pname TEXT := parent || '_' || to_char(month_start, 'YYYY_MM');
        BEGIN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                pname, parent, month_start, nxt
            );
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # --- Row Level Security (§4.1) -------------------------------------
    for tbl in TENANT_TABLES:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {tbl}
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

    # --- Grant CRUD to the app role (per-database) ----------------------
    op.execute("GRANT USAGE ON SCHEMA public TO skulpulse_app")
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public "
        "TO skulpulse_app"
    )
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO skulpulse_app")
    op.execute("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO skulpulse_app")
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO skulpulse_app"
    )

    # --- PgBouncer auth_query (SCRAM passthrough) ----------------------
    # SECURITY DEFINER function (owned by the superuser running this migration)
    # lets the non-superuser auth_user read SCRAM verifiers from pg_authid.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.pgbouncer_get_auth(p_username TEXT)
        RETURNS TABLE(username TEXT, password TEXT)
        LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS
        $$ SELECT rolname::text, rolpassword::text
           FROM pg_authid WHERE rolname = p_username AND rolcanlogin; $$;
        """
    )
    op.execute("REVOKE ALL ON FUNCTION public.pgbouncer_get_auth(TEXT) FROM PUBLIC")
    op.execute(
        "GRANT EXECUTE ON FUNCTION public.pgbouncer_get_auth(TEXT) TO skulpulse_app"
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS public.pgbouncer_get_auth(TEXT)")
    op.execute("DROP FUNCTION IF EXISTS create_log_partition(TEXT, DATE)")
    for tbl in [
        "error_logs",
        "api_request_logs",
        "idempotency_records",
        "audit_logs",
        "subscription_change_log",
        "school_module_subscriptions",
        "terms",
        "academic_years",
        "refresh_tokens",
        "tenant_users",
        "schools",
        "roles",
        "parishes",
        "sub_counties",
        "counties",
        "districts",
        "regions",
        "platform_config",
        "module_catalog",
        "platform_admins",
        "tenants",
    ]:
        op.execute(f"DROP TABLE IF EXISTS {tbl} CASCADE")
    for enum in [
        "actor_type",
        "subscription_action",
        "term_status",
        "academic_year_status",
        "user_type",
        "user_status",
        "sex_composition",
        "boarding_status",
        "registration_status",
        "ownership",
        "tenant_status",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")

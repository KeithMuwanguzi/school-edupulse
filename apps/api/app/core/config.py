"""Application settings loaded from environment (§10)."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database — app traffic via PgBouncer; migrations use direct Postgres.
    database_url: str = "postgresql+asyncpg://skulpulse:skulpulse@localhost:6432/skulpulse"
    migration_database_url: str = (
        "postgresql+asyncpg://skulpulse:skulpulse@localhost:5432/skulpulse"
    )
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "change-me"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7
    bcrypt_rounds: int = 12

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Platform bootstrap
    platform_admin_email: str = "admin@skulpulse.ug"
    platform_admin_password: str = "ChangeMe!Admin2025"
    platform_base_fee_ugx: int = 100_000

    # Uploaded media (school badges, etc.)
    media_storage_path: str = "storage"

    # Runtime
    environment: str = "development"
    log_level: str = "INFO"
    log_json: bool = True
    request_log_body_hash: bool = True

    # Platform maintenance — wipe tenant data but keep platform admin (pre-go-live testing).
    platform_allow_data_reset: bool = False

    # Outbound email (transactional SMTP — see docs/EMAIL-SETUP.md)
    smtp_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_email: str = "info@skulpulse.com"
    smtp_from_name: str = "SkulPulse"
    tenant_portal_url: str = "http://localhost:3005"
    platform_portal_url: str = "http://localhost:3005/platform/sign-in"

    # Structured audit files (JSONL — Serilog-style file sink for platform portal download).
    platform_audit_log_dir: str = "storage/platform-audit"
    platform_audit_file_enabled: bool = True

    # Connection pool (per API instance — §4.1)
    pool_size: int = 20
    max_overflow: int = 10
    statement_timeout_ms: int = 30_000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

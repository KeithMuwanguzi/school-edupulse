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

    # HttpOnly refresh cookie (cross-subdomain SPA auth)
    refresh_cookie_enabled: bool = True
    refresh_cookie_name: str = "skulpulse_refresh"
    refresh_cookie_path: str = "/api/v1/auth"
    refresh_cookie_domain: str = ""  # e.g. .skulpulse.com in production
    refresh_cookie_secure: bool = False  # overridden True in production via env
    refresh_cookie_samesite: str = "lax"  # "none" for cross-subdomain HTTPS prod

    # Metrics scraping (required in production when set)
    metrics_token: str = ""

    # API process scaling (uvicorn workers per container)
    api_workers: int = 4

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
    request_log_sample_rate: float = 1.0  # 0.0–1.0; reduce DB write pressure at scale

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

    # Reverse proxy — when true, X-Forwarded-For / X-Real-IP are trusted for client IP.
    trust_proxy_headers: bool = False

    # Rate limiting (Redis sliding window + progressive backoff)
    rate_limit_api_enabled: bool = True
    rate_limit_login_ip_per_minute: int = 10
    rate_limit_login_id_per_minute: int = 20
    rate_limit_refresh_ip_per_minute: int = 30
    rate_limit_api_burst: int = 50
    rate_limit_api_burst_window_seconds: int = 10
    rate_limit_api_sustained_per_minute: int = 300
    rate_limit_api_user_per_minute: int = 600
    rate_limit_violation_threshold: int = 5
    rate_limit_violation_window_seconds: int = 300
    rate_limit_block_seconds: int = 900

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def validate_for_production(self) -> list[str]:
        """Return fatal misconfiguration messages for production boot."""
        issues: list[str] = []
        if not self.is_production:
            return issues
        if self.jwt_secret in ("", "change-me"):
            issues.append("JWT_SECRET must be set to a strong random value in production.")
        elif len(self.jwt_secret) < 32:
            issues.append("JWT_SECRET should be at least 32 characters in production.")
        if self.platform_admin_password in ("", "ChangeMe!Admin2025"):
            issues.append("PLATFORM_ADMIN_PASSWORD must be changed from the default.")
        if not self.cors_origin_list or "localhost" in self.cors_origins:
            issues.append("CORS_ORIGINS must list production domains only.")
        if self.refresh_cookie_enabled and not self.refresh_cookie_secure:
            issues.append("REFRESH_COOKIE_SECURE must be true in production.")
        if self.refresh_cookie_enabled and self.refresh_cookie_samesite.lower() != "none":
            issues.append(
                "REFRESH_COOKIE_SAMESITE must be 'none' for cross-subdomain cookie auth."
            )
        if not self.metrics_token:
            issues.append("METRICS_TOKEN must be set in production.")
        return issues


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

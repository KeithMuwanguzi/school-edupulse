"""Pytest fixtures.

Tests run against a dedicated `skulpulse_test` database on direct Postgres
(port 55432, bypassing PgBouncer). Env vars are set BEFORE the app is imported
so the module-level engine binds to the test DB. The real Alembic migration is
applied so RLS, indexes and partitions match production.
"""
from __future__ import annotations

import asyncio
import os
import sys

# asyncpg is unreliable on Windows' Proactor loop; force the Selector loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- Point the app at the test DB before importing anything app-side -------
TEST_DB = "skulpulse_test"
_OWNER = "postgresql+asyncpg://skulpulse:skulpulse@localhost:55432"
_APP = "postgresql+asyncpg://skulpulse_app:skulpulse_app@localhost:55432"
# App/DB sessions use the non-superuser role so RLS is enforced in tests; the
# migration runs as the owner role.
os.environ["DATABASE_URL"] = f"{_APP}/{TEST_DB}"
os.environ["MIGRATION_DATABASE_URL"] = f"{_OWNER}/{TEST_DB}"
os.environ["REDIS_URL"] = "redis://localhost:6380/1"
os.environ["ENVIRONMENT"] = "test"
os.environ["LOG_JSON"] = "false"
os.environ["PLATFORM_ADMIN_EMAIL"] = "admin@skulpulse.ug"
os.environ["PLATFORM_ADMIN_PASSWORD"] = "TestAdmin!2025"
os.environ["PLATFORM_ALLOW_DATA_RESET"] = "true"

import asyncpg  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

DYNAMIC_TABLES = [
    "api_request_logs",
    "error_logs",
    "idempotency_records",
    "audit_logs",
    "subscription_change_log",
    "school_module_subscriptions",
    "refresh_tokens",
    "terms",
    "subjects",
    "streams",
    "student_guardians",
    "student_health",
    "student_discipline_records",
    "student_registration_responses",
    "student_term_registrations",
    "registration_requirements",
    "registration_sections",
    "hostel_rooms",
    "hostels",
    "students",
    "teacher_assignments",
    "timetable_slots",
    "attendance_records",
    "fee_payments",
    "fee_invoice_lines",
    "fee_invoices",
    "fee_structure_lines",
    "fee_structures",
    "classes",
    "academic_years",
    "tenant_users",
    "schools",
    "tenants",
]


async def _create_test_db() -> None:
    conn = await asyncpg.connect(
        host="localhost", port=55432, user="skulpulse", password="skulpulse",
        database="skulpulse", ssl=False,
    )
    try:
        # Always start from a clean DB so the current migration content (grants,
        # functions, partitions) is applied — revision id alone won't catch edits.
        await conn.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    finally:
        await conn.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _prepare_database():
    await _create_test_db()

    # Apply the real migration (RLS, partitions, indexes).
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")

    # Seed reference data once (roles, modules, config, geo, platform admin).
    from scripts import seed

    await seed.main()
    yield


@pytest_asyncio.fixture
async def db():
    """Direct session to the test DB for DB-level assertions (e.g. RLS)."""
    from app.core.db import SessionLocal

    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def _clean_dynamic_tables():
    """Truncate per-test dynamic data; reference data persists for the session.

    Runs as the owner role (app role lacks TRUNCATE) on a throwaway engine.
    """
    yield
    from sqlalchemy.ext.asyncio import create_async_engine

    from app.core.redis import redis_client

    admin = create_async_engine(
        os.environ["MIGRATION_DATABASE_URL"], connect_args={"ssl": False}
    )
    async with admin.begin() as conn:
        await conn.execute(
            text("TRUNCATE " + ", ".join(DYNAMIC_TABLES) + " RESTART IDENTITY CASCADE")
        )
    await admin.dispose()
    await redis_client.flushdb()


@pytest_asyncio.fixture
async def client():
    """HTTP client bound to the ASGI app (test DB via env)."""
    from app.main import app

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_headers(client) -> dict:
    """Authorization header for the seeded platform admin."""
    resp = await client.post(
        "/api/v1/auth/platform/login",
        json={"email": "admin@skulpulse.ug", "password": "TestAdmin!2025"},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def onboard_and_login(
    client, admin_headers, code: str, module_keys: list[str] | None = None
) -> tuple[dict, dict]:
    """Onboard a school and log in as its 0001 admin. Returns (headers, onboard_body)."""
    payload = sample_onboard_payload(code)
    if module_keys is not None:
        payload["module_keys"] = module_keys
    created = await client.post(
        "/api/v1/platform/schools", json=payload, headers=admin_headers
    )
    assert created.status_code == 201, created.text
    login = await client.post(
        "/api/v1/auth/tenant/login",
        json={"username": f"0001@{code}", "password": "ChangeMe!2025"},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return headers, created.json()


def sample_onboard_payload(code: str = "STPETERS") -> dict:
    return {
        "school_code": code,
        "name": "St. Peter's Primary School",
        "ownership": "private",
        "phone": "+256700000000",
        "email": "admin@stpeters.ac.ug",
        "head_teacher_name": "Jane Nakato",
        "contact_person_name": "Jane Nakato",
        "contact_person_phone": "+256700000001",
        "status": "trial",
        "module_keys": ["core", "students", "teachers", "academics"],
        "admin_user": {
            "name": "Jane Nakato",
            "login_id": "0001",
            "password": "ChangeMe!2025",
            "email": "admin@stpeters.ac.ug",
        },
    }

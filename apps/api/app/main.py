"""SkulPulse Uganda API — application entrypoint.

Wiring is added step by step (§9). Step 1: app + health. Later steps register
middleware, exception handlers, and feature routers.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exception_handlers import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.routers import auth, branding, health
from app.routers.platform import admins as platform_admins
from app.routers.platform import geo as platform_geo
from app.routers.platform import logs as platform_logs
from app.routers.platform import modules as platform_modules
from app.routers.platform import schools as platform_schools
from app.routers.platform import system as platform_system
from app.routers.tenant import assessment as tenant_assessment
from app.routers.tenant import admissions as tenant_admissions
from app.routers.tenant import academic as tenant_academic
from app.routers.tenant import attendance as tenant_attendance
from app.routers.tenant import circulars as tenant_circulars
from app.routers.tenant import classes as tenant_classes
from app.routers.tenant import modules as tenant_modules
from app.routers.tenant import ple as tenant_ple
from app.routers.tenant import reportcards as tenant_reportcards
from app.routers.tenant import school as tenant_school
from app.routers.tenant import students as tenant_students
from app.routers.tenant import grading as tenant_grading
from app.routers.tenant import finance as tenant_finance
from app.routers.tenant import hostel as tenant_hostel
from app.routers.tenant import term_registration as tenant_term_registration
from app.routers.tenant import subjects as tenant_subjects
from app.routers.tenant import teachers as tenant_teachers
from app.routers.tenant import timetable as tenant_timetable
from app.routers.tenant import users as tenant_users

configure_logging()
log = get_logger("skulpulse.app")

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("app.startup", environment=settings.environment)
    yield
    log.info("app.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="SkulPulse Uganda API",
        version="0.1.0",
        description="Multi-tenant SaaS for Ugandan primary schools (P1–P7).",
        lifespan=lifespan,
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
    )

    # Request logging is the OUTERMOST app middleware so it sees every request,
    # including those short-circuited by other middleware. CORS is added after
    # (and therefore runs inside) it.
    app.add_middleware(CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    # Outermost: security headers on every response + body-size guard.
    app.add_middleware(SecurityHeadersMiddleware)

    register_exception_handlers(app)

    # Routers
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(branding.router, prefix=API_PREFIX)
    app.include_router(platform_schools.router, prefix=API_PREFIX)
    app.include_router(platform_admins.router, prefix=API_PREFIX)
    app.include_router(platform_modules.router, prefix=API_PREFIX)
    app.include_router(platform_geo.router, prefix=API_PREFIX)
    app.include_router(platform_logs.router, prefix=API_PREFIX)
    app.include_router(platform_system.router, prefix=API_PREFIX)
    app.include_router(tenant_school.router, prefix=API_PREFIX)
    app.include_router(tenant_academic.router, prefix=API_PREFIX)
    app.include_router(tenant_circulars.router, prefix=API_PREFIX)
    app.include_router(tenant_subjects.router, prefix=API_PREFIX)
    app.include_router(tenant_classes.router, prefix=API_PREFIX)
    app.include_router(tenant_users.router, prefix=API_PREFIX)
    app.include_router(tenant_students.router, prefix=API_PREFIX)
    app.include_router(tenant_admissions.router, prefix=API_PREFIX)
    app.include_router(tenant_term_registration.router, prefix=API_PREFIX)
    app.include_router(tenant_grading.router, prefix=API_PREFIX)
    app.include_router(tenant_teachers.router, prefix=API_PREFIX)
    app.include_router(tenant_timetable.router, prefix=API_PREFIX)
    app.include_router(tenant_attendance.router, prefix=API_PREFIX)
    app.include_router(tenant_reportcards.router, prefix=API_PREFIX)
    app.include_router(tenant_ple.router, prefix=API_PREFIX)
    app.include_router(tenant_finance.router, prefix=API_PREFIX)
    app.include_router(tenant_hostel.router, prefix=API_PREFIX)
    app.include_router(tenant_assessment.router, prefix=API_PREFIX)
    app.include_router(tenant_modules.router, prefix=API_PREFIX)

    if not settings.is_production:
        _register_debug_routes(app)

    return app


def _register_debug_routes(app: FastAPI) -> None:
    """Dev-only routes to exercise the error path (§9 Step 2b tests)."""
    from fastapi import APIRouter

    debug = APIRouter(prefix=API_PREFIX, tags=["debug"])

    @debug.get("/_debug/boom")
    async def boom() -> dict:
        raise RuntimeError("intentional failure for error-log testing")

    app.include_router(debug)


app = create_app()

# SkulPulse Uganda

Modular, multi-tenant school-management SaaS for **Ugandan primary schools** (P1–P7).

- **Production app** — `apps/api` (FastAPI) + `apps/web` (Next.js). Phase 1 is built and tested.
- **Reference** — [`docs/BUILD-GUIDE.md`](docs/BUILD-GUIDE.md) (source of truth) and the HTML prototype at the repo root (`prototype.html`, `admin/`) for UX only.

Stack: FastAPI · PostgreSQL 16 · PgBouncer · Redis 7 · Next.js 14 (App Router, TS) · Tailwind · Redux Toolkit (RTK Query).

---

## Monorepo layout

```
apps/
  api/    FastAPI — auth, onboarding, modules, logging, RLS multi-tenancy
  web/    Next.js — platform admin (/admin) + tenant portal (/app)
docs/BUILD-GUIDE.md
docker-compose.yml
```

---

## Quick start (Docker Compose)

**Full walkthrough:** [`docs/RUN-ON-DOCKER.md`](docs/RUN-ON-DOCKER.md) — prerequisites, sign-in, onboard a school, troubleshooting.

**User guide (operations):** [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) — section-by-section flows, import templates, and go-live checklist.

Brings up Postgres + PgBouncer + Redis + API + Web. Migrations and seed run automatically on API start.

```powershell
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3005/ |
| School login | http://localhost:3005/ *(or `/login` redirects here)* |
| Platform console *(internal)* | http://localhost:3005/platform/sign-in |
| API docs | http://localhost:5330/api/v1/docs |
| Postgres (direct, migrations) | localhost:55432 |
| PgBouncer (app traffic) | localhost:56432 |
| Redis | localhost:6380 |

> Web/API use host ports **3005** and **5330** (not 3000/8000) to avoid clashes. Run `docker compose ps` to confirm. Web mapping is `3005:3000` — Next.js listens on 3000 inside the container.

**Default platform admin** (change in production): `admin@skulpulse.ug` / value of `PLATFORM_ADMIN_PASSWORD`.

---

## Local development

### 1. Infrastructure

```powershell
docker compose up -d postgres pgbouncer redis
```

### 2. API

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head      # migrations → direct Postgres
.\.venv\Scripts\python.exe -m scripts.seed              # roles, modules, admin, districts
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 3. Web

```powershell
cd apps/web
npm install
npm run dev    # http://localhost:3000
```

---

## Testing

The suite runs against a dedicated `skulpulse_test` database (created/migrated automatically) on **direct Postgres** so PostgreSQL RLS is genuinely exercised.

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m pytest -q
```

Covers: RLS isolation, schema invariants, request/error logging, platform & tenant auth + refresh rotation/reuse detection, onboarding idempotency, module gating, and API-level tenant isolation.

Web: `npm run typecheck` and `npm run build` in `apps/web`.

---

## Architecture highlights (see BUILD-GUIDE for detail)

- **Multi-tenancy** — one DB, `tenant_id` on every school-owned row, **Row-Level Security** enforced via a non-superuser app role (`skulpulse_app`) + per-request `app.current_tenant_id` GUC; platform routes use an explicit RLS bypass GUC. Every tenant index leads with `tenant_id`.
- **Auth** — bcrypt (cost 12), JWT access (15m) + rotating refresh (7d) with reuse detection; tenant login is `loginId@SCHOOLCODE`.
- **Module entitlements** — middleware gates unsubscribed modules (`403 MODULE_NOT_SUBSCRIBED`); entitlements cached in Redis and carried in the JWT.
- **Idempotency** — `Idempotency-Key` on onboard/module/profile mutations (Redis + `idempotency_records`).
- **Observability** — every request writes `api_request_logs`; errors write `error_logs`; append-only `audit_logs`. All correlated by `X-Request-ID`. Log tables are month-partitioned. Structured JSON logs to stdout.
- **Connection management** — PgBouncer (transaction mode) via SCRAM passthrough; `statement_timeout` set on the app role.

---

## HTML prototype (pitch demo, no backend)

```powershell
python -m http.server 8080
```

`index.html` (pitch) · `admin/index.html` (onboarding) · `prototype.html` (school portal). UX reference only — not used by the production app.

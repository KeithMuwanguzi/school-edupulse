# EduPulse Uganda — Pitch Prototype

HTML-only interactive prototype for pitching school directors and guiding development. No backend, no build step.

## Quick Start

Open in any browser:

1. **Pitch page:** `index.html` — marketing landing for directors
2. **Admin portal:** `admin/index.html` — onboard schools, assign modules
3. **School demo:** `prototype.html` — full clickable app per tenant

Or serve locally:

```bash
# Python (PowerShell)
Set-Location E:\Code\School; python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`

## School portal login

**One username, no separate school-code step.** A username is `ID@SCHOOLCODE`; the system reads the
school from the code and the role from the matched account, then routes the user to the right portal
(parents land on the parent portal — there is no student portal).

**Sign-in flow** (`prototype.html`): user enters **username** + **password**. `EduStore.authenticateByUsername()`
splits on the last `@`, finds the school by code, matches the account by `loginId`, verifies the password,
and stores a session (`userId`, `schoolId`, `roleId`, `username`, `loginId`). RBAC + module gates apply.

**Login id convention** (`EduStore.STAFF_LOGIN_IDS` / `_parentLoginId`):

| Role | Login id | Example username |
|------|----------|------------------|
| School admin | `0001` | `0001@GAYAZA` |
| Deputy head | `0002` | `0002@GAYAZA` |
| Teacher | `0003` | `0003@GAYAZA` |
| Bursar | `0004` | `0004@GAYAZA` |
| Parent | 7-digit **student number** | `2203992@GAYAZA` |

Password pattern for auto-created accounts: `{SCHOOLCODE}@{role}` (e.g. `MENGO@teacher`). Expand
“Demo credentials by school” on the login page (or Admin → School detail → Portal access) for exact values.
Prefill links: `prototype.html?u=0001@SMACK` (full username) or `?code=SMACK` (defaults to the admin username).

**Future backend mapping:** `authenticateByUsername()` → `POST /auth/login` with `{ username, password }`;
parse tenant from the code, return a JWT with `tenantId` + `roleId`. `PortalAuth` session → httpOnly cookie or bearer token.

**School self-service (school-admin):** Settings → School profile, preferences, portal accounts list. Subscriptions → toggle modules with live billing; changes persist to shared store and sync with admin portal.

## Pitch Flow (Recommended)

1. Start on `index.html` — walk through problem, features, pricing, comparison table
2. Open **Admin portal** — show onboarding a new school and toggling modules
3. Click **Open school portal** for that tenant (or use `prototype.html?school=sch-003`)
4. Demo as **School Administrator** — sidebar only shows subscribed modules
5. Switch to **Parent** in top bar — show report card portal and MoMo fee payment
6. Switch to **Teacher** — show limited nav (RBAC in action)
7. Navigate to a module the school does not subscribe to (e.g. Library for Mengo) — lock overlay
8. Open **Module Subscriptions** — invoice matches admin assignment
9. Back in admin — enable AI Analytics, refresh school tab — nav updates via shared store

## Multi-Tenant Simulation

Both portals read/write the same `localStorage` key (`edupulse_store_v1`):

| Portal | Path | Purpose |
|--------|------|---------|
| Admin | `admin/index.html` | CRUD schools, module picker, billing, audit |
| School | `prototype.html` | Role-based demo scoped to active school |

**Workflow:** Admin assigns modules → school portal sidebar and locks reflect that subscription. Use two browser tabs (admin + prototype) for live demos.

Seed schools (reset via Admin → Settings):

| ID | School | Modules |
|----|--------|---------|
| `sch-001` | St. Mary's College Kisubi | Full stack (no library/transport add-ons) |
| `sch-002` | Gayaza High School | All catalog modules |
| `sch-003` | Mengo Senior School | Academic core only (6 modules) |
| `sch-004` | Namilyango College | Trial — no AI |

URL params:

- `prototype.html?school=sch-003` — open portal as that tenant
- `admin/index.html?school=sch-001` — jump to school detail

## File Structure → Future Backend Mapping

```
School/
├── index.html                 → Marketing site
├── admin/index.html           → Platform admin SPA shell
├── prototype.html             → School tenant app shell
├── assets/
│   ├── css/main.css           → Design tokens + components + bold/vivid chart layer
│   └── js/
│       ├── icons.js           → Inline SVG icon set
│       ├── charts.js          → Dependency-free animated SVG charts (bars, line, donut, gauge, ring, sparkline, heatmap, hbars)
│       ├── mock-data.js       → Catalog + billing + DataEngine (seeded generator) + Analytics (aggregations)
│       ├── store.js           → Shared tenant store + portal users
│       ├── auth.js            → Login session (future: JWT)
│       ├── admin-app.js       → Admin router + screens
│       └── app.js             → School portal router + screens
```

### Data engine & analytics (mock-data.js)

Student/performance/fee data is **generated deterministically** from a seeded PRNG (`DataEngine.build()`),
so the demo is rich (~90 students across S.1–S.6, per-subject score history, attendance, fees, computed
UNEB division + risk level) but stable across reloads. The `Analytics` object derives every chart and AI
insight from this dataset (`byClass`, `byLevel`, `riskDistribution`, `divisionForecast`, `subjectHeatmap`,
`finance`, `watchlist`, `topPerformers`, …).

**Future backend mapping:** `DataEngine` → seed migrations / fixtures; `Analytics` methods → SQL aggregate
queries or a reporting service. AI insights (`buildInsight`) → the model-serving endpoint that returns
risk score, predicted division, factors, and recommendations per student.

### Screen IDs → Future Routes

| Prototype Screen | Future Route | Module ID |
|-----------------|--------------|-----------|
| `dashboard` | `/dashboard` | `core` |
| `students` | `/students` | `students` |
| `teachers` | `/teachers` | `teachers` |
| `admissions` | `/admissions` | `admissions` |
| `academic-structure` | `/academics` | `academics` |
| `assessment` | `/assessment` | `assessment` |
| `report-cards` | `/report-cards` | `reportcards` |
| `timetable` | `/timetable` | `timetable` |
| `attendance` | `/attendance` | `attendance` |
| `ai-analytics` | `/ai-analytics` | `ai-analytics` |
| `finance` | `/finance` | `finance` |
| `communication` | `/communication` | `communication` |
| `library` | `/library` | `library` |
| `transport` | `/transport` | `transport` |
| `hostel` | `/hostel` | `hostel` |
| `modules` | `/settings/subscriptions` | `core` |
| `rbac` | `/settings/roles` | `core` |
| `academic-years` | `/settings/academic-years` | `core` |
| `audit-log` | `/settings/audit-log` | `core` |
| `settings` | `/settings` | `core` |

### Admin Screens → Future Routes

| Admin Screen | Future Route |
|--------------|--------------|
| `dashboard` | `/admin` |
| `schools` | `/admin/schools` |
| `onboard` | `/admin/schools/new` |
| `school-detail` | `/admin/schools/:id` |
| `billing` | `/admin/billing` |
| `catalog` | `/admin/modules` |
| `audit` | `/admin/audit` |
| `settings` | `/admin/settings` |

### Mock Data Entities → Future Database Tables

| Mock Object | Future Table/Entity |
|-------------|---------------------|
| `EduStore` / `EDUPULSE.school` | `schools` |
| `school.subscribedModules` | `school_module_subscriptions` |
| `EduStore.platformAudit` | `platform_audit_logs` |
| `EDUPULSE.academicYears` | `academic_years` |
| `EDUPULSE.terms` | `terms` |
| `EDUPULSE.billing` | `billing_config` |
| `EDUPULSE.modules` | `modules` (catalog) |
| `EDUPULSE.roles` | `roles` |
| `EDUPULSE.rbacMatrix` | `role_module_permissions` |
| `EDUPULSE.students` | `students` (+ `student_guardians`) |
| `EDUPULSE.teachers` | `staff` |
| `EDUPULSE.classes` | `classes` |
| `EDUPULSE.subjects` | `subjects` |
| `EDUPULSE.assessments` | `assessments` |
| `EDUPULSE.reportCardSample` | `report_cards` + `report_card_grades` |
| `EDUPULSE.aiInsights` | `ai_student_insights` |
| `EDUPULSE.feeRecords` | `fee_invoices` + `fee_payments` |
| `EDUPULSE.admissionsPipeline` | `admission_applications` |
| `EDUPULSE.auditLog` | `audit_logs` |

## Key Architecture Decisions (Encoded in Prototype)

### 1. Module Subscription Gate
- Platform admin assigns modules per school (`EduStore.setSchoolModules`)
- School portal reads active tenant via `EduStore.syncToEdupulse()` → `EDUPULSE.school`
- Unsubscribed modules are hidden from sidebar; direct navigation shows lock overlay
- Implemented in `App.hasModuleAccess()`, `App.getNavGroups()`, `App.navigate()`

### 2. RBAC (Role-Based Access Control)
- Permissions are **module-scoped** (`view`, `create`, `edit`, `delete`, `approve`, `export`)
- RBAC only applies within subscribed modules
- Role switcher in top bar demonstrates different nav + access levels

### 3. Academic Year / Term Isolation
- Year + Term selectors in top bar scope ALL data queries
- Archived years are read-only (see Academic Years screen)

### 4. Multi-Tenant Platform
- Dedicated admin portal at `/admin/` for onboarding and billing
- Each school is a tenant with isolated module entitlements
- Demo student/teacher data is shared across tenants (prototype only)

## Differentiators vs Existing Ugandan Systems

- Modular pricing (pay for what you use — no per-student fees)
- AI at-risk prediction and UCE/UACE forecasting
- Parent portal with digital report cards
- MTN MoMo / Airtel Money native fee payments
- Strict term/year data isolation
- Custom RBAC per school
- MoES/EMIS compliance exports
- UNEB-standard grading (CA 40% + Exam 60%)
- SMS for parents without smartphones

## Customization Before Pitch

**Schools & modules:** Use the admin portal, or edit `EduStore.SEED_SCHOOLS` in `assets/js/store.js`.

**Catalog pricing:** Edit `assets/js/mock-data.js` → `modules` and `billing.platformBaseFee`.

**Demo entities:** Edit students, teachers, etc. in `mock-data.js` (shared across tenants in prototype).

## Next Development Phase

When moving from prototype to production:

1. Replace `EduStore` localStorage with REST/GraphQL API (`/admin/*`, `/tenant/*`)
2. Extract design tokens from `main.css` into your component library
3. Convert mock shapes into TypeScript interfaces / Prisma schema
4. Map each `render*()` function to a React/Vue page component
5. Implement API middleware: `(tenantId, moduleId, permission) => boolean`
6. Add academic context middleware: all queries include `academicYearId` + `termId`

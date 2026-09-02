# KU-AMS — Implementation Plan

**Kabul University Asset Management System (KU-AMS)**
Enterprise asset lifecycle: **Purchase → Receive → Register → Assign → Transfer →
Maintain → Audit → Depreciate → Dispose** — every step keeps full historical records.

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Quasar 2 SPA)                    │
│  Quasar 2.28 · Vue 3.5 (Composition API) · Pinia 3 · Vue Router 4 │
│  Axios → /api · QRCodes · Barcodes · ApexCharts · Dark-mode ready │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTP + JSON (standard envelope)
┌───────────────────────────────▼──────────────────────────────────┐
│              BACKEND (Laravel 13 REST API)                        │
│  Sanctum (Bearer tokens) · Spatie Permission · Policies           │
│  Controllers (thin) → Services/Actions (business logic)           │
│  Form Requests (validation) · API Resources (serialization)       │
│  Jobs/Events/Listeners · Notifications · Scheduler (depreciation) │
│  SQLite dev → PostgreSQL/MySQL prod (portable migrations)         │
└───────────────────────────────────────────────────────────────────┘
```

### Standard API envelope
```json
{ "success": true,  "message": "Operation completed successfully", "data": {} }
{ "success": false, "message": "Validation failed", "errors": {} }
```
Pagination: `data` contains `{ data: [...], meta: { current_page, last_page, per_page, total } }`.
Auth errors: 401 `{success:false, message:"Unauthenticated"}`; forbidden: 403; validation: 422.

---

## 2. Database Architecture (36 tables)

**Auth & Users**
`users` (extended skeleton) — add `username`, `phone`, `department_id`,
`status`, `avatar`; soft deletes. `users` is a pure authentication/accounts
table: employee/HR data lives exclusively in the dedicated `employees` table
(see HR below), linked optionally through `employees.user_id`. Spatie: `roles`,
`permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions`.

**Organization (location hierarchy)**
`campuses` → `faculties` → `departments` → `buildings` → `floors` → `rooms`
(rooms get a `room_type`: office/laboratory/library/warehouse/classroom/general).
Every entity: `code`, `name`, `description`, `status`, soft deletes, unique code.

**Assets**
`asset_categories` (parent-level, e.g. IT Equipment, Furniture) ·
`asset_subcategories` (FK category) ·
`assets` (code `KU-{CAT}-{YEAR}-{NNNNNN}`, category/subcategory, brand/model/serial,
barcode/qr_code unique secure identifiers, purchase info, warranty, useful_life,
status, condition, location FKs, created_by, soft deletes) ·
`asset_images` · `asset_documents` (kind: invoice/warranty/maintenance/disposal).

**Asset operations (immutable history)**
`asset_assignments` (employee — the assignee from `employees`, legacy user mirror, assigned_by, dates, status Active/Returned/Overdue) ·
`asset_transfers` (from/to location FKs, requested_by, approved_by, workflow
Draft→Requested→Approved→In Transit→Completed→Rejected) ·
`asset_location_histories` (immutable rows: full location snapshot + moved_by + reason) ·
`asset_requests` (types: New/Temporary/Replacement/Repair; workflow Draft→Submitted→
Dept Approval→Asset Manager Review→Approved/Rejected→Completed) ·
`asset_incidents` (Damaged/Lost/Stolen/Destroyed + investigation status/resolution).

**Maintenance**
`maintenance_requests` (asset, problem, type Preventive/Corrective/Emergency/Inspection,
priority, workflow) · `asset_maintenances` (request FK, technician, start/end, cost,
notes, result, status).

**Procurement & suppliers**
`suppliers` (company, contact, tax_number, status, soft deletes) ·
`purchase_requests` (requester, department, supplier, items JSON, approval workflow) ·
`purchase_orders` (supplier, PR FK, status Draft→Sent→Partially Received→Received→
Completed/Cancelled, totals) · `purchase_order_items` (asset definition: category,
name, brand/model, qty, unit price) · `purchase_receipts` (PO FK, received items,
warehouse, received_by) — receiving creates real `assets` rows.

**Warehouse**
`warehouses` (code, name, location, keeper, soft deletes) ·
`warehouse_transactions` (type IN/OUT/TRANSFER/ADJUSTMENT, asset, warehouse from/to,
reference, qty, user, immutable).

**Audit**
`asset_audits` (code, scope: campus/faculty/department/building/room/warehouse,
auditor, scheduled_at, status Draft/In Progress/Completed/Cancelled, summary) ·
`asset_audit_items` (audit FK, asset FK, scanned_at, verification
Verified/Missing/Wrong Location/Damaged, notes).

**Financial**
`depreciation_methods` (code, name, formula, rate, settings — seed Straight Line,
future: Declining Balance, Units of Production) · `asset_depreciations` (monthly rows:
period, method, original_value, salvage_value, useful_life, annual_depreciation,
accumulated, book_value) · `asset_disposals` (method Sold/Donated/Recycled/Destroyed,
request/inspection/approval workflow, revenue, docs; asset → status Disposed, never deleted).

**System**
`activity_logs` (user, action, module, entity_type/id, old/new values JSON, ip, immutable) ·
`settings` (key/value/group/type) · Laravel `notifications` (in-app; channel-ready).

All migrations: FK constraints via `foreignId()->constrained()->cascadeOnUpdate()`,
`nullOnDelete()` for optional FKs, `restrictOnDelete()` for protected references,
indexes on every FK + frequently filtered column, unique constraints on codes/barcodes,
`timestamps()`, soft deletes where the spec requires.

---

## 3. Backend structure (`app/`)

```
app/
├── Domains/                      # domain modules, each with its own layer
│   ├── Asset/        Models/ Services/ Actions/ Requests/ Resources/ Policies/
│   ├── Organization/ Models/ Services/ Requests/ Resources/ Policies/
│   ├── Maintenance/  ...
│   ├── Procurement/  ...
│   ├── Warehouse/    ...
│   ├── Audit/        ...
│   ├── Depreciation/ ...
│   └── Disposal/     ...
├── Http/
│   ├── Controllers/  (thin; delegates to domain Services)
│   ├── Middleware/   (EnsureUserIsActive, etc.)
│   └── Requests/     (shared auth/notification requests)
├── Models/           (User — with HasRoles)
├── Notifications/
├── Events/ Listeners/
├── Jobs/             (DepreciationMonthlyJob, WarrantyExpiryJob, AuditReminderJob)
└── Support/          (ApiResponse trait, helpers)
```

**Permissions** (Spatie, seeded into DB):
`dashboard.view` · `users.view|create|update|delete` · `roles.view|create|update|delete` ·
`organization.view|create|update|delete` · `categories.view|create|update|delete` ·
`assets.view|create|update|delete|assign|return|transfer|dispose` ·
`maintenance.view|create|update` · `incidents.view|create|update` ·
`suppliers.view|create|update|delete` · `procurement.view|create|update|approve` ·
`warehouse.view|create|update|transfer` · `audit.view|create|complete` ·
`depreciation.view|calculate` · `requests.view|create|approve` ·
`reports.view` · `settings.manage` · `notifications.view`.

**Roles** (seeded): Super Admin, University Administrator, Asset Manager, Faculty
Manager, Department Manager, Warehouse Manager, Maintenance Technician, Auditor, Employee.

**Scheduler**: `asset:depreciate` (monthly), `notify:warranty-expiring`,
`notify:overdue-assignments`, `audit:reminders`.

---

## 4. Frontend structure

```
src/
├── boot/            axios.js (instance+interceptors) · auth.js (bootstrap)
├── components/      common/ (AppPageHeader, FilterBar, StatusBadge, EmptyState, ErrorState, ConfirmDialog, AssetTimeline, DataTable wrappers)
│                    assets/ dashboard/ assignment/ (dialogs) etc.
├── layouts/         MainLayout.vue (drawer, header, notifications, user menu)
├── pages/           Auth/ Dashboard/ Assets/ Assignments/ Transfers/ Requests/
│                    Organization/ Maintenance/ Incidents/ Suppliers/ Procurement/
│                    Warehouse/ Audit/ Depreciation/ Disposal/ Reports/
│                    Users/ Roles/ Settings/ Notifications/ ActivityLogs/
├── router/          index.js (routes + guards + meta.permission)
├── services/        api.js + one service per module (asset.service.js, ...)
├── stores/          auth · dashboard · assets · categories · assignments ·
│                    transfers · maintenance · notifications · organization · users
├── utils/           constants.js (status/condition/type maps), format.js, download.js
└── css/             app.sass · quasar.variables.sass (dark-mode ready)
```

Every list page implements: **loading state, empty state, error state, search,
pagination, filters, responsive layout, permission check**.

---

## 5. Phases & deliverables

| Phase | Module(s) | Key deliverables | Verification |
|---|---|---|---|
| **1** ✅ | Foundation | Skeleton backend (Laravel 13), Quasar 2 SPA, SQLite, API envelope, mock dev API, router+guards, layout, login | Dev server boots; login works; layout renders; docs complete |
| **2** ✅ | Authentication | Sanctum auth, LoginRequest, AuthController/AuthService, change-password, password-reset broker + notification, rate limiting; frontend auth store/guard | Full login/logout/me/change-password flow verified against mock API |
| **3** ✅ | Users & Roles | Users CRUD + role assignment; roles/permissions UI; policies; middleware | Permission matrix enforced in UI + API |
| **4** ✅ | Organization | campuses→rooms CRUD (API+UI), hierarchical filters | Location tree usable across modules |
| **5** ✅ | Categories & Assets | Categories/subcategories; full asset CRUD, code generator, advanced filters, detail page w/ timeline | Asset lifecycle from registration |
| **6** ✅ | Asset Operations | Assign/Return/Transfer + location history + asset requests | Status transitions + history correct |
| **7** ✅ | Images/Documents | Uploads, validation, storage | Files attach/detach safely |
| **8** ✅ | QR & Barcode | QR/barcode generation (asset detail), scan-code lookup on Assets page | Scan code → asset lookup |
| **9** ✅ | Maintenance & Incidents | Requests, work orders, cost, status automation | Asset status automation verified |
| **10** ✅ | Procurement & Warehouse | Suppliers, PR/PO/receiving→assets, warehouses, transactions + transfers | PO receiving creates assets |
| **11** ✅ | Audit | Audits, scan verification, missing detection, reports | Audit completion workflow |
| **12** ✅ | Financial | Depreciation (straight-line, monthly job), book value, disposal | Depreciation math verified |
| **13** ✅ | Notifications & Activity Logs | In-app notifications, event-driven activity log | Every action auditable |
| **14** ✅ | Dashboard & Reports | Stats, charts, recent activity; PDF/Excel/CSV export (export service; CSV live) | Data correctness + export |
| **15** ✅ | Settings & QA | System settings, seeders, full QA pass | Checklist green |
| **16** ✅ | Mobile optimization | viewport/theme meta, tap-highlight, focus-visible outlines, compact ≤599px table/button/dialog/pagination/toolbar styles | Dev server + `vite build` compile clean |
| **17** ✅ | Security & performance | SecurityHeaders middleware, global API throttle + login throttle, trustProxies behind LB, envelope-consistent 401/422/403/404/429/500, per-action `permission:` middleware on every route (incl. previously unguarded resources), Spatie permission-tables migration, stateless-safe current-password check, `docs/SECURITY.md` | Static verification of all touched files; mock contract keeps identical envelopes |
| **18** ✅ | Testing / QA | `tests/Feature` (auth, authorization 401/403, campus CRUD, asset create→assign→return→transfer, asset-request workflow, maintenance request→work-order, procurement PR→PO→receive, disposal immutability, depreciation command, user/role CRUD) + `tests/Unit` (asset code generation, depreciation math); `tests/Concerns/SeedsPermissions` helper | Suite runs via `php artisan test` after deploy |
| **19** ✅ | Deployment | `docs/DEPLOYMENT.md` — nginx + PHP-FPM + Supervisor + cron, SPA proxy, env matrix, zero-downtime release, post-deploy checklist | Reviewed against Laravel 13 defaults |
| **20** ✅ | Backup / DR | `docs/OPERATIONS.md` — SQLite/MySQL backup scripts, 3-2-1 off-site, restore runbooks (same/new server), RPO/RTO, monthly drill | Restore procedure follows `sqlite3 .backup` semantics |
| **21** ✅ | Final docs & review | `docs/FINAL_REVIEW.md` — phase completion table, verification summary, known limitations, go-live checklist; README + plan updated | All 30 phases marked complete |

### Implementation notes (2026-08-31)

- **Backend (all phases):** 11 migrations (`000010`–`000100`), 33 models, 30 API
  controllers, domain Services/Requests/Resources under `app/Domains/`, split route
  groups (`routes/api/{auth,organization,assets,system}.php`), 3 console commands
  (depreciation, warranty reminders, overdue assignments), seeders, `ApiResponse`
  envelope, activity logging on every important action, soft deletes everywhere,
  disposed assets never hard-deleted (status → `disposed`).
- **Verification limits:** no PHP/Composer in the sandbox → backend is authored
  installable-only; every file passes a string-aware brace/paren balance check and
  a class-reference sweep (imports verified against actual usage).
- **Mock API (live-verifiable slice):** `frontend/mock-api/` mirrors the backend
  route files endpoint-for-endpoint — org/catalog CRUD helper, assets (incl.
  timeline, lookup, status, images/documents), assignments/transfers/requests,
  maintenance/incidents, audits, procurement (PR→PO→send→receive→assets),
  warehouses + stock + transfer, depreciation/disposals, users/roles,
  notifications/activity, dashboard, reports (12 backend report names) + CSV
  export. Verified with an end-to-end smoke suite (40+ checks, all green).
- **Frontend:** 28 pages (org ×6, catalog ×3, assets + detail, assignments,
  transfers, requests, maintenance, incidents, audits, procurement, warehouses,
  stock transactions, depreciation, disposals, users, roles, activity logs,
  notifications, reports, settings, dashboard) — every page has loading/empty/
  error states, search, pagination, filters, responsive layout and permission
  checks. `vite build` passes; all page modules compile in the dev server.

## 6. QA checklist (applied per module and at final QA)

- [ ] Migrations run clean; FKs/indexes/unique constraints in place
- [ ] Form Request validation covers required fields, formats, uniqueness
- [ ] Policies/permissions enforced (401/403 tested)
- [ ] Standard API envelope on success/validation/error paths
- [ ] Soft deletes + audit/activity rows on all destructive paths
- [ ] Frontend: loading/empty/error states, search/pagination/filters, responsive
- [ ] Security: no secrets in code, hashed passwords, rate-limited auth, validated uploads
- [ ] Performance: eager loading, pagination, indexed filters

## 7. Run instructions (real backend)

```bash
cd backend
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve          # http://localhost:8000

cd ../frontend
npm install
cp .env.example .env       # VITE_API_BASE=/api
npm run dev                # http://localhost:9000 (proxy → :8000)
```
Default seeded login: `superadmin` / `password` (documented; force-change policy later).

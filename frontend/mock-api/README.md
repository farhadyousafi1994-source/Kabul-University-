# KU-AMS Development Mock API

A **development-only** REST API that mirrors the Laravel backend contract so the
Quasar SPA is fully usable without PHP. It is served by the Vite dev server from
`/api` and persists its data in SQLite (`mock-api/data/ku-ams.sqlite`, gitignored).

## How it works

- `index.js` — Vite plugin (`kuAmsMockApi`) mounted in `vite.config.js`
- `server.js` — tiny HTTP router with the standard KU-AMS envelope,
  Bearer-token sessions and permission checks
- `db.js` — full database schema (mirrors the Laravel migrations 1:1) + seed data
- `routes/*.js` — one route group per backend module:
  `auth`, `dashboard`, `notifications`, `activity`, `users` (users/roles CRUD),
  `organization` (campuses→rooms), `catalog` (categories/subcategories/suppliers),
  `assets` (CRUD, lookup, timeline, images/documents, status),
  `operations` (assignments, transfers, asset requests),
  `maintenance` (requests, work orders, incidents),
  `audit-procurement` (audits, purchase requests/orders),
  `warehouse` (warehouses, stock, transactions, transfers),
  `financial` (depreciation, disposals),
  `system` (settings, reports + CSV export),
  `backup` (backup & restore, clean-start template)

## Backup & restore (Module 29)

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/backups` | `backup.view` | history + summary meta (count, total size, last backup) |
| POST | `/api/backups` | `backup.create` | take a snapshot — `{ "format": "sqlite" \| "json" }` |
| GET | `/api/backups/fresh-template` | `backup.create` | clean-start JSON (users & lists kept, records emptied) |
| POST | `/api/backups/restore` | `backup.restore` | replace all records with an uploaded JSON snapshot |
| GET | `/api/backups/:id/download` | `backup.view` | the backup file (`.sqlite` copy of the dev database or `.json` dump) |
| DELETE | `/api/backups/:id` | `backup.delete` | delete the file and its record |

Snapshots are written to `mock-api/data/backups/` (gitignored) and a seeded
history is created on first boot so the screen has something to show. A
`pre_restore` safety snapshot is taken automatically before every restore;
`sessions` and `backups` are never overwritten, so you stay logged in.

## Employees module (HR)

Employees live in a dedicated `employees` table — separate from `users`
(auth accounts) — and can optionally be linked to an account via `user_id`.
Assets carry a nullable `assets.employee_id` (Asset belongsTo Employee).

| Method | Endpoint | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/employees` | `employees.view` | search, `department_id`, `status`, `employment_type`, sort, pagination; rows include `full_name`, `department_name`, `assets_count` |
| POST | `/api/employees` | `employees.create` | auto `employee_code` (`EMP-NNNN`) when blank |
| GET | `/api/employees/:id` | `employees.view` | detail + `asset_summary` (total / active / under_maintenance / total_value) |
| PUT | `/api/employees/:id` | `employees.update` | full update, unique email/code/user, manager ≠ self |
| DELETE | `/api/employees/:id` | `employees.delete` | **422** while assets are still assigned — unassign/reassign first |
| GET | `/api/employees/:id/assets` | `employees.view` | assets currently assigned to the employee |

Setting `employee_id` on `PUT /api/assets/:id` auto-flips the asset status
`available ⇄ assigned` (only from available/assigned/reserved and only when no
explicit `status` is sent). Deleting an employee never touches user accounts.

## Switching to the real Laravel API

```bash
# backend running on :8000
cd frontend
KU_AMS_USE_MOCK=false npm run dev
```

Requests to `/api` are then proxied to `http://127.0.0.1:8000` (see
`vite.config.js`). **No frontend code changes are needed.**

## Demo accounts

All seeded passwords are `password`:

| Username | Role |
|---|---|
| `superadmin` | Super Admin |
| `administrator` | University Administrator |
| `assetmanager` | Asset Manager |
| `facultymanager` | Faculty Manager |
| `deptmanager` | Department Manager |
| `warehousemanager` | Warehouse Manager |
| `technician` | Maintenance Technician |
| `auditor` | Auditor |
| `employee` | Employee |

## Keeping the mock in sync with the backend

Every route group in `routes/index.js` corresponds to a group in
`backend/routes/api.php`. When a backend route changes, mirror it here and bump
the QA checklist item in `docs/IMPLEMENTATION_PLAN.md`.

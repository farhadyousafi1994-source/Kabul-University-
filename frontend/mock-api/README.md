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
  `system` (settings, reports + CSV export)

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

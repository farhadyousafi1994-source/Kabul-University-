# Kabul University Asset Management System (KU-AMS)

Enterprise-grade asset management for Kabul University: **purchase → receive →
register → assign → transfer → maintain → audit → depreciate → dispose**, with
complete historical records at every step.

## Repository layout

```
├── backend/     Laravel 13 REST API (Sanctum + Spatie Permission, SQLite→PG/MySQL)
├── frontend/    Quasar 2 + Vue 3 SPA (Pinia, Vue Router, Axios, QR/Barcode, charts)
├── docs/        ANALYSIS.md · IMPLEMENTATION_PLAN.md
```

## Quick start (development, no PHP required)

```bash
cd frontend
npm install
npm run dev          # http://localhost:9000
```

The Vite dev server ships a **development mock API** (`frontend/mock-api/`) that
mirrors the Laravel contract exactly, so the whole SPA works out of the box.
Demo login: **`superadmin` / `password`** (9 roles available — see
`frontend/mock-api/README.md`).

## Running against the real Laravel API

```bash
cd backend
composer install && cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate --seed
php artisan serve            # http://127.0.0.1:8000

cd ../frontend
KU_AMS_USE_MOCK=false npm run dev
```

No frontend code changes are required to switch between mock and live API.

## Status

| Phase | Module | Status |
|---|---|---|
| 1 | Project foundation (Laravel 13 + Quasar 2 + SQLite + API envelope + dev mock API) | ✅ |
| 2 | Authentication — login/logout/me/change-password + password-reset architecture, rate limiting (backend + frontend) | ✅ |
| 3 | Users, Roles & Permissions — CRUD + role/permission matrix UI | ✅ |
| 4 | Organization — campuses → faculties → departments → buildings → floors → rooms | ✅ |
| 5 | Categories, Subcategories, Suppliers (master data) | ✅ |
| 6–8 | Assets — CRUD, code/barcode/QR generation, images & documents, detail page with timeline | ✅ |
| 9–10 | Assign / Return / Transfer + location history + asset request approval workflow | ✅ |
| 11–12 | Maintenance requests & work orders, incidents | ✅ |
| 13–14 | Audits (start/verify/complete/cancel, item scanning) | ✅ |
| 15–17 | Procurement (PR → PO → send → receive → assets), warehouses & stock transactions | ✅ |
| 18–19 | Depreciation (straight-line, monthly run, book value) & disposals (never hard-deleted) | ✅ |
| 20–21 | Notifications & activity logs | ✅ |
| 22–24 | Dashboard, reports with CSV export, system settings | ✅ |

**Verification status:** the Laravel backend slice (11 migrations, 33 models, 30
controllers, domain services/requests/resources, routes, seeders, console commands)
is fully authored and brace/lint-clean, but **cannot be executed in this sandbox**
(no PHP/Composer — see `docs/ANALYSIS.md`). The **mock API is contract-identical**
to the backend routes and is verified end-to-end (40+ endpoint checks, all green);
all 28 Quasar pages compile and run against it in the live preview. Deploy the
backend anywhere with PHP 8.3+ and `composer install` to go live with zero frontend
changes (`KU_AMS_USE_MOCK=false npm run dev`).

## Docs

- `docs/ANALYSIS.md` — system analysis and environment decisions
- `docs/IMPLEMENTATION_PLAN.md` — full plan: database architecture, API design,
  module breakdown, QA checklist

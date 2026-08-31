# KU-AMS — Laravel REST API (Backend)

Kabul University Asset Management System — enterprise asset lifecycle API.

## Stack

- **Laravel 13** (PHP ≥ 8.3)
- **Laravel Sanctum** — bearer-token authentication
- **Spatie Laravel Permission** — roles & permissions
- **SQLite** for development (PostgreSQL/MySQL ready — all migrations use the
  portable schema builder; no SQLite-specific SQL)
- **barryvdh/laravel-dompdf** — PDF reports
- **maatwebsite/excel** — Excel/CSV exports

## Quick start

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve          # http://127.0.0.1:8000
```

The seeder creates the full role/permission matrix, the organization tree
(campuses → faculties → departments → buildings → floors → rooms), sample
categories, suppliers and users.

### Seeded demo accounts (password: `password`)

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

## API conventions

- Base path: `/api`
- Authentication: `Authorization: Bearer <token>` (Sanctum)
- Envelope:

```json
{ "success": true,  "message": "…", "data": {} }            // 2xx
{ "success": false, "message": "Validation failed", "errors": {} } // 422
{ "success": false, "message": "Unauthenticated." }          // 401
{ "success": false, "message": "…permission…" }              // 403
```

- Pagination: `?page=1&per_page=20` → `data: { data: […], meta: { current_page, last_page, per_page, total } }`
- Search/filter/sort per module: `?search=…&status=…&category_id=…&sort=name`

## Architecture

```
app/
├── Domains/          # per-module Models, Services, Actions, Requests, Resources, Policies
│   ├── Asset/  Organization/  Maintenance/  Procurement/  Warehouse/
│   ├── Audit/  Depreciation/  Disposal/     Security/     System/
├── Http/
│   ├── Controllers/  # thin — delegates to domain Services
│   ├── Middleware/   # EnsureUserIsActive, permission aliases
├── Models/           # User (HasRoles)
├── Jobs/             # depreciation, warranty, overdue reminders
└── Support/          # ApiResponse, code generators, exports
```

Route groups are mounted in `routes/api.php` phase by phase (see the header
comment there for the module map).

## Development

```bash
php artisan test       # feature tests per module
php artisan pint       # code style
php artisan schedule:run   # monthly depreciation, warranty/overdue reminders
```

> **Note:** the Quasar SPA can run against this API by setting
> `KU_AMS_USE_MOCK=false` in `frontend/.env` — see `frontend/mock-api/README.md`.

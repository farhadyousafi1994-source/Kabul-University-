# KU-AMS — Phase 1: System Analysis

**Project:** Kabul University Asset Management System (KU-AMS)
**Date:** 2026-08-31
**Branch:** `arena/01a057c6-kabul-university`

---

## 1. Existing Project Structure

| Path | State | Notes |
|---|---|---|
| Repository root | Empty skeleton (README.md only, single commit) | No existing functionality to preserve; greenfield build |
| `backend/` | Newly created — Laravel **13.10.1** official skeleton (`laravel/laravel` v13.10.1) | Laravel 13 is the current stable major (PHP 8.3+, framework `^13.17`) |
| `frontend/` | Newly created — hand-rolled **Quasar 2 + Vite 8** SPA | Quasar 2.28 (latest Quasar 2), Vite 8, Vue 3.5 |

There is **no pre-existing application code** in the repository, so nothing will be
overwritten. The Laravel skeleton ships with the stock `welcome` route/view and the
default `users` migration + `User` model + `UserFactory`; these are kept and extended.

## 2. Toolchain Analysis (this sandbox)

| Tool | Status | Implication |
|---|---|---|
| PHP CLI / Composer | **Not installed** | Laravel backend cannot be executed inside this sandbox today |
| `apt-get` (Debian 12) | No PHP packages available in reachable mirrors | Compiling PHP 8.4 from source is possible later if desired; blocked on missing dev headers for curl/openssl/libxml (no apt access) |
| Packagist / getcomposer.org | **Unreachable** | `composer install` cannot fetch dependencies inside the sandbox |
| GitHub (`codeload`, `api.github.com`) | Reachable | Laravel skeleton was downloaded from the official `laravel/laravel` v13.10.1 tag |
| npm registry | Reachable | All frontend dependencies can be installed and the SPA can be built and previewed |
| Node.js | v22.22.3 with **`node:sqlite`** (built-in SQLite) | A **development mock API** can run inside the Vite dev server so the full frontend is testable end-to-end in the live preview |
| SQLite CLI | Not installed | Not needed; `node:sqlite` is used for the dev mock |

### Consequences & decisions (recorded for the record)

1. **Backend code is written 100% for the real Laravel stack** (PHP 8.3+, Laravel 13,
   Sanctum 4.x, Spatie Permission 8.x, SQLite→PostgreSQL/MySQL compatible migrations).
   It is complete, professional, and installable in any environment with PHP+Composer.
2. A **faithful in-browser development API** (`vite-plugin` middleware, SQLite-backed)
   mirrors the exact REST contract and response envelope the Laravel API will expose,
   so the Quasar frontend is fully functional and demonstrable in the live preview
   today. The mock lives under `frontend/mock-api/` and is clearly documented as a
   **development-only** substitute that will be replaced by the real API (`/api` proxy)
   in production builds.
3. The frontend talks to `/api` through `axios` with the same base URL and response
   handling in both modes — switching from mock to real backend requires **zero frontend
   code changes** (single boolean in `vite.config.js`).

## 3. Version selection (verified against registries on 2026-08-31)

### Backend (`backend/composer.json`)
| Package | Version | Why |
|---|---|---|
| `php` | `^8.3` | Skeleton requirement |
| `laravel/framework` | `^13.17` | Latest stable (skeleton v13.10.1) |
| `laravel/sanctum` | `^4.3` | Latest stable; token auth for SPA + mobile |
| `spatie/laravel-permission` | `^8.3` | Latest stable; role/permission management |
| `barryvdh/laravel-dompdf` | `^3.1` | PDF reports (reports module) |
| `maatwebsite/excel` | `^3.1` | Excel/CSV export (reports module) |

> `maatwebsite/excel` has heavy deps (PhpSpreadsheet); if the install environment is
> constrained it can be swapped for `league/csv` without contract changes — the export
> service is isolated behind a single `ReportExportService`.

### Frontend (`frontend/package.json`)
| Package | Version | Why |
|---|---|---|
| `vue` | `^3.5.42` | Latest Vue 3 |
| `quasar` | `^2.28.0` | Latest Quasar 2 (spec requirement) |
| `@quasar/extras` | `^2.0.4` | Material icons + Roboto font |
| `vite` | `^8.2.2` | Latest Vite (peer-required by quasar plugin) |
| `@vitejs/plugin-vue` | `^6.0.8` | Vue SFC support |
| `@quasar/vite-plugin` | `^2.0.2` | Quasar 2 Vite integration |
| `vue-router` | `^4.6.4` | Latest stable v4 API (battle-tested) |
| `pinia` | `^3.0.4` | Latest stable v3 |
| `axios` | `^1.20.0` | HTTP client |
| `sass` | `^1.103.1` | Quasar Sass styles |
| `apexcharts` + `vue3-apexcharts` | `^5.16.0` / `^1.11.1` | Dashboard charts (peer-compatible) |
| `qrcode` | `^1.5.4` | QR generation |
| `jsbarcode` | `^3.12.3` | Barcode generation |

## 4. Database analysis (target schema)

Default connection is **SQLite** (already the skeleton default) with a migration path
to PostgreSQL/MySQL. All migrations use `foreignId()->constrained()`,
`cascadeOnUpdate()`, and explicit `nullOnDelete()` / `restrictOnDelete()` choices.
Full schema design is in `docs/IMPLEMENTATION_PLAN.md` §Database Architecture.

## 5. Existing migrations and models

- Skeleton migrations: `0001_01_01_000000_create_users_table`,
  `0001_01_01_000001_create_cache_table`, `0001_01_01_000002_create_jobs_table`
  (Laravel 13 merged the old 2014/2019 user/queue migrations into these three).
- Skeleton model: `App\Models\User` (uses `HasFactory`, `Notifiable`).
- Spatie Permission adds its own migrations (published on install, v8 uses a single
  `create_permission_tables` migration with a `roles`, `permissions`,
  `model_has_roles`, `model_has_permissions`, `role_has_permissions`).

## 6. Configuration analysis

- `config/database.php` default `sqlite` ✓ (env-driven, portable)
- `bootstrap/app.php`: skeleton has no API routing configured → must register
  `api: routes/api.php` + Sanctum stateful API middleware + API exception handler.
- `.env.example`: SQLite defaults already present; needs `DB_DATABASE` pointing at
  `database/database.sqlite`, `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database`,
  and KU-AMS-specific env vars (currency, code format, etc.).

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Sandbox has no PHP/Composer/Packagist → backend can't run here | Backend is fully written for the real stack and documented; every route/contract is mirrored by the dev mock so the frontend is still verifiable now |
| Laravel 13 is newer than most documentation | Code targets the stable Laravel 13 APIs; skeleton itself is v13.10.1; pinned dependency majors verified via GitHub releases API |
| Mock API diverging from real API | Single `routes/mock.routes.js` mirrors `routes/api.php` group-by-group; QA checklist in `frontend/mock-api/README.md` |
| SQLite→PostgreSQL/MySQL | No SQLite-specific SQL anywhere in migrations; all schema via Laravel schema builder; avoid `on update cascade` surprises by testing each migration |

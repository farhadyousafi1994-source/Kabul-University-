# KU-AMS — Security

Security posture and hardening checklist for the Kabul University Asset
Management System (backend + frontend).

## Implemented

### Authentication & sessions
- **Sanctum bearer tokens** for API auth; tokens hashed at rest
  (`hashToken`), 24h expiry, logout revokes the token server-side.
- Login rate-limited: `throttle:5,1` (5 attempts/min/IP); password reset
  endpoints throttled separately (`throttle:3,1` / `throttle:5,1`).
- Global API throttle `60,1` per IP (`API_THROTTLE_RATE`, configurable).
- Passwords hashed with bcrypt (`Hash::make`); minimum 8 characters enforced
  by Form Requests. Deactivated users are rejected at login **and** on every
  request (`EnsureUserIsActive` middleware).
- Change-password revokes all other tokens.

### Authorization
- **Spatie Permission** matrix: 30+ granular permissions seeded into 9 roles.
- Every API route is guarded by `permission:X` middleware — no unauthenticated
  or unauthorized mutation endpoints exist.
- Route-level policies mirror the permission matrix; controllers stay thin and
  delegate to domain services (no business logic bypass).

### Input validation & data integrity
- Every write endpoint has a dedicated **Form Request** (required fields,
  formats, uniqueness, `exists:` FK checks, `in:` enums, numeric bounds).
- Standardized envelope for validation failures: 422 with `errors`.
- **Soft deletes** on all master data (assets, categories, suppliers,
  warehouses, org structure, users). **Disposed assets are never hard-deleted**
  — their status becomes `disposed` and the record remains for audit.
- All destructive/history paths write immutable rows
  (`asset_location_histories`, `activity_logs`, audit items).

### Response hardening (`SecurityHeaders` middleware)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cache-Control: no-store, private`
- HSTS is delegated to the TLS terminator (nginx/LB) — see `docs/DEPLOYMENT.md`.

### Frontend
- Token stored in `localStorage`, attached only to same-origin `/api` calls;
  axios interceptor redirects to login on 401.
- Every route carries `meta.permission`; the router guard rejects navigation
  without permission; the sidebar hides unauthorized entries.
- No secrets in client code; the mock API is dev-only and disabled in
  production builds (`KU_AMS_USE_MOCK=false`, `vite build` never bundles it).

### Dependencies & secrets
- All secrets live in `.env` (gitignored); `.env.example` documents every
  variable with no real values.
- Dependencies pinned to stable majors, verified at install time with
  `composer audit` / `npm audit`.

## Hardening checklist before production

- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] TLS termination with HSTS (`max-age=31536000; includeSubDomains`)
- [ ] `TRUSTED_PROXIES` set to the LB/proxy CIDR
- [ ] `composer audit` and `npm audit` clean
- [ ] Backups verified with a test restore (see `docs/OPERATIONS.md`)
- [ ] `php artisan migrate --force` on deploy; scheduler + queue running
- [ ] SPA served over HTTPS with `Content-Security-Policy` added at nginx if a
      strict policy is required (Quasar + inline styles need `'unsafe-inline'`
      for styles; API is CSP-irrelevant as JSON)

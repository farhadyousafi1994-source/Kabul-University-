# KU-AMS — Deployment Guide (Phase 28)

Production deployment reference for the Kabul University Asset Management
System. The stack is a **Laravel 13 REST API** (PHP 8.3+) plus a **Quasar 2 SPA**
(static build) served by **nginx**, with **Supervisor** managing the queue worker
and a cron entry for the scheduler.

---

## 1. Topology

```
                    ┌─────────────────────────────┐
   Browser ────────▶│  nginx :443 (TLS)          │
                    │  ├── /      → SPA static    │
                    │  └── /api/* → PHP-FPM       │
                    │  └── /up    → health check  │
                    └─────────────┬───────────────┘
                                  │ PHP-FPM (php8.3-fpm)
                    ┌─────────────▼───────────────┐
                    │  Laravel application        │
                    │  .env  · storage/  · sqlite │
                    └───────┬──────────┬──────────┘
                            │          │
                      Supervisor      cron
                   queue:work      schedule:run
```

- The SPA talks to the API through a same-origin relative `/api` (nginx proxy),
  so no CORS configuration is needed and no API host leaks into the frontend.
- Sanitized requests: the API is stateless (Sanctum bearer tokens).

## 2. Server requirements

| Component | Requirement |
|---|---|
| OS | Ubuntu 22.04/24.04 LTS (or Debian 12) |
| PHP | 8.3+ with extensions: `ctype, curl, dom, fileinfo, filter, gd, hash, intl, json, mbstring, openssl, pcre, pdo, pdo_sqlite (or pdo_mysql), session, tokenizer, xml, zip` |
| Composer | 2.x |
| Node | 20 LTS+ (build-time only) |
| Database | SQLite (default) or MySQL 8 / MariaDB 10.6+ |
| Web server | nginx 1.24+ |
| Process manager | Supervisor (queue worker) |
| TLS | Let's Encrypt via certbot |

## 3. Backend deployment

```bash
# 1. Ship the code
rsync -az --exclude '.git' --exclude 'node_modules' backend/ /srv/ku-ams/backend/
cd /srv/ku-ams/backend

# 2. Dependencies + environment
composer install --no-dev --optimize-autoloader --prefer-dist
cp .env.example .env
php artisan key:generate

# 3. Configure .env (see §6) then migrate + seed
touch database/database.sqlite
php artisan migrate --force
php artisan db:seed --force        # roles/permissions, org, catalog, demo users

# 4. Storage + cache
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

> **Never** run `migrate`/`seed` while a release is being swapped unless you
> have verified the migration is backward-compatible; prefer blue/green
> releases for the API (see §8).

## 4. Frontend build

```bash
cd /srv/ku-ams/frontend
npm ci --omit=dev || npm install
npm run build          # outputs dist/ (static SPA)
```

The build is environment-agnostic: all API calls use the relative `/api` base,
so the same bundle works in dev, staging and production.

## 5. nginx site configuration

```nginx
server {
    listen 80;
    server_name ams.ku.edu.af;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ams.ku.edu.af;

    ssl_certificate     /etc/letsencrypt/live/ams.ku.edu.af/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ams.ku.edu.af/privkey.pem;

    root /srv/ku-ams/frontend/dist;
    index index.html;

    # SPA history-mode routing: serve index.html for non-file paths.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API → PHP-FPM
    location /api {
        try_files $uri @laravel;
    }

    location @laravel {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /srv/ku-ams/backend/public/index.php;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param HTTP_PROXY "";
    }

    # Health check (used by load balancers / uptime monitors)
    location /up {
        proxy_pass http://unix:/run/php/php8.3-fpm.sock;
    }

    # Asset caching
    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers (see docs/SECURITY.md — HSTS terminates here)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
}
```

PHP-FPM pool hardening: `user = www-data`, `listen = /run/php/php8.3-fpm.sock`,
`pm.max_children = 20` (tune to RAM; Laravel ≈ 40–60 MB per worker).

## 6. Environment variables (production)

```dotenv
APP_ENV=production
APP_DEBUG=false              # CRITICAL — never true in production
APP_URL=https://ams.ku.edu.af
APP_KEY=                     # set by `php artisan key:generate`

DB_CONNECTION=sqlite         # or mysql
# DB_HOST=127.0.0.1  DB_DATABASE=ku_ams  DB_USERNAME=...  DB_PASSWORD=...

SANCTUM_STATEFUL_DOMAINS=ams.ku.edu.af
FRONTEND_URL=https://ams.ku.edu.af

# Rate limiting: 60 requests/min per IP; login throttled 5/min.
API_THROTTLE_RATE=60,1

# Only when behind a load balancer / reverse proxy:
TRUSTED_PROXIES=10.0.0.0/8
```

## 7. Queue worker + scheduler (Supervisor + cron)

```ini
# /etc/supervisor/conf.d/ku-ams-worker.conf
[program:ku-ams-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /srv/ku-ams/backend/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/srv/ku-ams/backend/storage/logs/worker.log
stopwaitsecs=3600
```

```cron
# /etc/cron.d/ku-ams-scheduler  (root)
* * * * * www-data php /srv/ku-ams/backend/artisan schedule:run >> /dev/null 2>&1
```

Scheduled tasks (defined in `routes/console.php`):

| Schedule | Command | Purpose |
|---|---|---|
| Monthly, 1st at 02:00 | `asset:depreciate` | Monthly depreciation batch |
| Daily at 07:00 | `notify:maintenance` | Warranty/maintenance due notifications |
| Daily at 08:00 | `assignment:mark-overdue` | Overdue assignment flags |

## 8. Release procedure (zero-downtime)

1. `composer install --no-dev --optimize-autoloader` on the new release dir.
2. Run **backward-compatible** migrations only: `php artisan migrate --force`.
3. `php artisan config:cache && php artisan route:cache && php artisan view:cache`.
4. `supervisorctl restart ku-ams-worker:*`.
5. `npm run build` and rsync `dist/` (atomic swap: rsync to temp, then `mv`).

## 9. Verification checklist (post-deploy)

- [ ] `curl -s https://ams.ku.edu.af/up` → 200
- [ ] `curl -s https://ams.ku.edu.af/api/` → `{"success":true,...}`
- [ ] Login as `superadmin`; create a user; assign an asset end-to-end
- [ ] `APP_DEBUG=false` confirmed; `php artisan about` shows production
- [ ] Security headers present (`curl -I`): nosniff, X-Frame-Options, HSTS
- [ ] `php artisan migrate:status` — all migrations applied
- [ ] Worker alive: `supervisorctl status ku-ams-worker:*` → RUNNING
- [ ] Scheduler firing: `grep schedule /var/log/syslog` or `storage/logs/laravel.log`
- [ ] Backup cron ran successfully (see `docs/OPERATIONS.md`)

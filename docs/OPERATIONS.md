# KU-AMS — Backup & Disaster Recovery (Phase 29)

Operational runbook for backups, restore drills and disaster recovery for the
Kabul University Asset Management System.

---

## 1. What must be backed up

| Data | Location | Frequency |
|---|---|---|
| Database (SQLite file or MySQL dump) | `backend/database/database.sqlite` | Daily (with hourly option) |
| Secrets / configuration | `backend/.env` | After every change |
| Uploaded files (asset images/documents) | `backend/storage/app/public` | Daily |
| Logs (optional, compliance) | `backend/storage/logs` | Weekly |
| Frontend build | `frontend/dist` | Per release (regenerable, low priority) |

> **Critical:** the SQLite database file must **never** be copied while a write
> is in progress — use `sqlite3 .backup` or the VACUUM INTO snapshot, not `cp`.
> If the file is live-copied, the WAL (`database.sqlite-wal`) must be included.

## 2. Backup scripts

### 2.1 Daily backup (SQLite)

```bash
#!/usr/bin/env bash
# /srv/ku-ams/scripts/backup-daily.sh
set -euo pipefail

APP_DIR=/srv/ku-ams/backend
BACKUP_ROOT=/srv/ku-ams/backups
STAMP=$(date +%Y-%m-%d)
BACKUP_DIR="$BACKUP_ROOT/daily/$STAMP"
mkdir -p "$BACKUP_DIR"

# 1. Consistent SQLite snapshot (safe while the app is running)
sqlite3 "$APP_DIR/database/database.sqlite" ".backup '$BACKUP_DIR/ku-ams.sqlite'"

# 2. Secrets & config (chmod 600)
cp "$APP_DIR/.env" "$BACKUP_DIR/.env"
chmod 600 "$BACKUP_DIR/.env"

# 3. Uploaded files
rsync -a --delete "$APP_DIR/storage/app/public/" "$BACKUP_DIR/storage-public/"

# 4. Checksum manifest
(cd "$BACKUP_DIR" && sha256sum ku-ams.sqlite .env > checksums.txt)

# 5. Retention: keep 30 daily, 12 weekly, 12 monthly
find "$BACKUP_ROOT/daily"    -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
find "$BACKUP_ROOT/weekly"   -mindepth 1 -maxdepth 1 -type d -mtime +84 -exec rm -rf {} +
find "$BACKUP_ROOT/monthly"  -mindepth 1 -maxdepth 1 -type d -mtime +365 -exec rm -rf {} +
```

Promote snapshots:

```bash
# weekly (Sundays) and monthly (1st) — copy the newest daily dir:
cp -a "$(ls -td "$BACKUP_ROOT"/daily/* | head -1)" "$BACKUP_ROOT/weekly/$(date +%Y-%m-%d)"
```

### 2.2 MySQL alternative

```bash
mysqldump --single-transaction --routines --triggers \
  -u ku_ams -p"$DB_PASS" ku_ams | gzip > "$BACKUP_DIR/ku-ams.sql.gz"
```

### 2.3 Off-site copy (defense in depth)

Encrypt and push off-site (rsync to a second site, or object storage):

```bash
gpg --encrypt --recipient ops@ku.edu.af "$BACKUP_DIR/ku-ams.sqlite"
rclone copy "$BACKUP_DIR" remote:ku-ams-backups/daily/"$STAMP" -q
```

**3-2-1 rule:** 3 copies, 2 media types, 1 off-site. Test restore at least
monthly (see §4).

## 3. Monitoring the backup

- Add a cron entry (`@daily /srv/ku-ams/scripts/backup-daily.sh`).
- Alert on failure: wrap with a sentinel — on error write to a known file and
  have a Nagios/UptimeRobot probe check `freshness of backups/`:

```bash
# Sentinel file: backups/last-backup.txt
echo "$(date -Is) OK" > "$BACKUP_ROOT/last-backup.txt"
```

- Verify integrity automatically: `sqlite3 "$BACKUP_DIR/ku-ams.sqlite" "PRAGMA integrity_check;"` must print `ok` (append to §2.1 step 4).

## 4. Restore procedure (disaster recovery)

### 4.1 Full restore (same server)

```bash
# 1. Stop the app (maintenance mode stops writes)
cd /srv/ku-ams/backend
php artisan down
supervisorctl stop ku-ams-worker:*

# 2. Restore database
sqlite3 database/database.sqlite ".restore '$BACKUP_DIR/ku-ams.sqlite'"

# 3. Restore uploaded files and .env
rsync -a "$BACKUP_DIR/storage-public/" storage/app/public/
cp "$BACKUP_DIR/.env" .env

# 4. Clear caches and bring back up
php artisan config:clear && php artisan cache:clear
supervisorctl start ku-ams-worker:*
php artisan up
```

### 4.2 Restore to a NEW server (bare-metal DR)

```bash
# 1. Fresh deploy (see docs/DEPLOYMENT.md §3) but do NOT seed
composer install --no-dev --optimize-autoloader
cp "$BACKUP_DIR/.env" .env

# 2. Restore database BEFORE first boot of the app
mkdir -p database
sqlite3 database/database.sqlite ".restore '$BACKUP_DIR/ku-ams.sqlite'"

# 3. Restore uploads
mkdir -p storage/app/public
rsync -a "$BACKUP_DIR/storage-public/" storage/app/public/
php artisan storage:link

# 4. Verify: login, check asset count + latest activity log
php artisan tinker --execute="dump(['assets' => \App\Domains\Asset\Models\Asset::count(), 'users' => \App\Models\User::count()]);"
```

### 4.3 Restore drill checklist (run monthly)

- [ ] Pick the most recent backup; restore to a scratch directory
- [ ] `PRAGMA integrity_check` passes
- [ ] App boots, login works, an asset lookup returns data
- [ ] Uploaded images/documents are viewable
- [ ] Record restore time + any failures in the ops log

## 5. RPO / RTO targets

| Metric | Target | Achieved by |
|---|---|---|
| RPO (max data loss) | ≤ 24 h (default), ≤ 1 h (optional hourly cron) | Daily backup + WAL checkpoints |
| RTO (max downtime) | ≤ 2 h | Tested restore procedure + spare server image |
| Backup verification | monthly | §4.3 drill |

## 6. Incident notes

- **Lost/corrupt database:** restore latest snapshot (§4). Because every
  important action is also written to `activity_logs` inside the same database,
  a restore recovers audit history consistently.
- **Compromised secrets:** rotate `APP_KEY` (invalidates all cookies/tokens),
  revoke Sanctum tokens (`DELETE FROM personal_access_tokens;`), rotate DB
  password and re-run `key:generate` + `php artisan config:cache`.
- **Ransomware:** keep backups off-site and offline-capable (§2.3); restore on
  a clean machine and audit the last activity logs before reconnecting.

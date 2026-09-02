import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ok, HttpError } from '../server.js'
import { DB_PATH, BACKUP_DIR, backupStamp } from '../db.js'
import { log } from './crud.helper.js'

/**
 * Module 29 — Backup & disaster recovery.
 *
 * Mirrors backend/routes/api/system.php (backup.* permission family) and the
 * BackupService contract:
 *
 *   GET    /api/backups                 -> index + meta (count, total size, last backup)
 *   POST   /api/backups                 -> create a snapshot on the server (and return it)
 *   GET    /api/backups/fresh-template  -> "clean start" JSON (users & lists kept, records empty)
 *   GET    /api/backups/:id/download    -> the backup file itself
 *   DELETE /api/backups/:id             -> forget a backup and delete its file
 *   POST   /api/backups/restore         -> replace every record with an uploaded snapshot
 *
 * Backups are real copies of the SQLite database file, so anything the page
 * downloads can be restored later. A safety copy is taken automatically
 * before every restore.
 */

mkdirSync(BACKUP_DIR, { recursive: true })

const DUMP_FORMAT = 'ku-ams-backup'
const DUMP_VERSION = 1

// Never overwritten by a restore: dropping `sessions` would log the restoring
// user out mid-request, and `backups` must keep pointing at real files.
const PROTECTED_TABLES = new Set(['sessions', 'backups'])

// Tables that keep their data in the "clean start" template: people, the
// organisation tree, master data and settings. Everything else is emptied.
const KEPT_IN_FRESH_START = new Set([
  'users', 'employees', 'roles', 'permissions', 'role_user', 'role_permission', 'settings',
  'campuses', 'faculties', 'departments', 'buildings', 'floors', 'rooms',
  'asset_categories', 'asset_subcategories', 'suppliers', 'warehouses',
  'depreciation_methods',
])

function tableNames(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name)
}

function columnsOf(db, table) {
  return db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name)
}

function humanSize(bytes) {
  const n = Number(bytes || 0)
  if (!n) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function serialize(row) {
  return {
    id: row.id,
    filename: row.filename,
    size: row.size,
    size_human: humanSize(row.size),
    driver: row.driver,
    format: row.format,
    kind: row.kind,
    created_by: row.created_by,
    created_at: row.created_at,
    download_url: `/api/backups/${row.id}/download`,
  }
}

/**
 * Copy the live database file into the backup directory and register it.
 * `kind` is manual | scheduled | pre_restore; `format` is sqlite (a real copy
 * of the database file) or json (a portable, restorable dump).
 */
function createBackup(db, { kind = 'manual', userId = null, at = new Date(), format = 'sqlite' } = {}) {
  const iso = at.toISOString()
  const useJson = format === 'json'
  const ext = useJson ? 'json' : 'sqlite'
  const stamp = backupStamp(at)

  // Two snapshots started in the same second (e.g. the pre-restore safety copy
  // and a manual one) must not overwrite each other.
  let filename = `backup-${stamp}.${ext}`
  let target = path.join(BACKUP_DIR, filename)
  for (let n = 2; existsSync(target); n++) {
    filename = `backup-${stamp}-${n}.${ext}`
    target = path.join(BACKUP_DIR, filename)
  }

  if (useJson) {
    const dump = {
      format: DUMP_FORMAT,
      version: DUMP_VERSION,
      kind: 'full',
      generated_at: iso,
      tables: dumpTables(db, { fresh: false }),
    }
    writeFileSync(target, JSON.stringify(dump, null, 2))
  } else {
    // Flush the write-ahead log first so the copy is a complete snapshot.
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    copyFileSync(DB_PATH, target)
  }

  const size = statSync(target).size

  const info = db
    .prepare(
      `INSERT INTO backups (filename, path, driver, format, kind, size, created_by, created_at, updated_at)
       VALUES (?, ?, 'sqlite', ?, ?, ?, ?, ?, ?)`,
    )
    .run(filename, target, useJson ? 'json' : 'sqlite', kind, size, userId, iso, iso)

  return db.prepare('SELECT * FROM backups WHERE id = ?').get(Number(info.lastInsertRowid))
}

/**
 * Dump every (or every kept) table into the portable JSON snapshot shape used
 * by both the mock API and the Laravel backend.
 */
function dumpTables(db, { fresh = false } = {}) {
  const tables = {}
  for (const table of tableNames(db)) {
    if (PROTECTED_TABLES.has(table)) continue
    tables[table] = fresh && !KEPT_IN_FRESH_START.has(table) ? [] : db.prepare(`SELECT * FROM "${table}"`).all()
  }
  return tables
}

export function backupRoutes(router) {
  // GET /api/backups — history + summary for the hero banner.
  router.get('/api/backups', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM backups ORDER BY created_at DESC, id DESC').all()
    const totalSize = rows.reduce((sum, r) => sum + (r.size || 0), 0)
    const last = rows[0] || null

    return ok('Backups retrieved successfully.', rows.map(serialize), {
      count: rows.length,
      total_size: totalSize,
      total_size_human: humanSize(totalSize),
      last_backup: last ? serialize(last) : null,
    })
  }, { auth: true, permission: 'backup.view' })

  // POST /api/backups — take a snapshot now (a copy stays on the server).
  // Body: { format: 'sqlite' | 'json' } (defaults to the live driver's format).
  router.post('/api/backups', (ctx) => {
    const format = ctx.body?.format === 'json' ? 'json' : 'sqlite'
    const row = createBackup(ctx.db, { kind: 'manual', userId: ctx.user.id, format })
    log(ctx, 'created', 'Backup', { id: row.id, name: row.filename })
    return ok('Backup created successfully.', serialize(row), null, 201)
  }, { auth: true, permission: 'backup.create' })

  // GET /api/backups/fresh-template — "clean start" snapshot to upload back.
  router.get('/api/backups/fresh-template', (ctx) => {
    const dump = {
      format: DUMP_FORMAT,
      version: DUMP_VERSION,
      kind: 'fresh-start',
      generated_at: new Date().toISOString(),
      tables: dumpTables(ctx.db, { fresh: true }),
    }
    const filename = `ku-ams-fresh-start-${new Date().toISOString().slice(0, 10)}.json`

    ctx.res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
    ctx.res.end(JSON.stringify(dump, null, 2))
  }, { auth: true, permission: 'backup.create' })

  // POST /api/backups/restore — replace all records with an uploaded snapshot.
  router.post('/api/backups/restore', (ctx) => {
    const dump = ctx.body?.data
    if (!dump || typeof dump !== 'object' || !dump.tables || typeof dump.tables !== 'object') {
      throw new HttpError(422, 'Validation failed', { data: ['A valid KU-AMS backup snapshot is required.'] })
    }

    const tables = Object.keys(dump.tables)
    if (!tables.length) {
      throw new HttpError(422, 'Validation failed', { data: ['The backup file contains no tables.'] })
    }

    // Safety net: whatever happens next, the current state stays recoverable.
    const safety = createBackup(ctx.db, { kind: 'pre_restore', userId: ctx.user.id })

    const existing = new Set(tableNames(ctx.db))
    let restored = 0
    let rows = 0

    ctx.db.exec('PRAGMA foreign_keys = OFF')
    ctx.db.exec('BEGIN')
    try {
      for (const table of tables) {
        if (PROTECTED_TABLES.has(table) || !existing.has(table)) continue
        const incoming = dump.tables[table]
        if (!Array.isArray(incoming)) continue

        ctx.db.exec(`DELETE FROM "${table}"`)

        if (incoming.length) {
          const columns = columnsOf(ctx.db, table)
          const keys = columns.filter((c) => Object.prototype.hasOwnProperty.call(incoming[0], c))
          if (keys.length) {
            const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
            const stmt = ctx.db.prepare(sql)
            for (const record of incoming) {
              stmt.run(...keys.map((k) => record[k] ?? null))
              rows++
            }
          }
        }

        // Keep autoincrement counters in step with the restored rows.
        ctx.db.exec(`DELETE FROM sqlite_sequence WHERE name = '${table.replace(/'/g, "''")}'`)
        restored++
      }
      ctx.db.exec('COMMIT')
    } catch (err) {
      ctx.db.exec('ROLLBACK')
      throw err
    } finally {
      ctx.db.exec('PRAGMA foreign_keys = ON')
    }

    log(ctx, 'restored', 'Backup', { id: safety.id, name: `restored ${restored} tables` })

    return ok('System restored successfully.', {
      tables: restored,
      rows,
      safety_backup: serialize(safety),
    })
  }, { auth: true, permission: 'backup.restore' })

  // GET /api/backups/:id/download — the backup file itself.
  router.get('/api/backups/:id/download', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM backups WHERE id = ?').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Backup not found.')
    if (!existsSync(row.path)) throw new HttpError(404, 'Backup file is missing on the server.')

    ctx.res.writeHead(200, {
      'Content-Type': row.format === 'json' ? 'application/json; charset=utf-8' : 'application/x-sqlite3',
      'Content-Disposition': `attachment; filename="${row.filename}"`,
      'Content-Length': statSync(row.path).size,
    })
    ctx.res.end(readFileSync(row.path))
  }, { auth: true, permission: 'backup.view' })

  // DELETE /api/backups/:id — forget the backup and remove its file.
  router.delete('/api/backups/:id', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM backups WHERE id = ?').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Backup not found.')

    ctx.db.prepare('DELETE FROM backups WHERE id = ?').run(row.id)
    try {
      rmSync(row.path, { force: true })
    } catch {
      // The file may already be gone — the record is what matters.
    }

    log(ctx, 'deleted', 'Backup', { id: row.id, name: row.filename })
    return ok('Backup deleted successfully.', { id: row.id })
  }, { auth: true, permission: 'backup.delete' })
}

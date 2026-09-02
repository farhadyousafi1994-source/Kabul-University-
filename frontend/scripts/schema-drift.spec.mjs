/**
 * Regression test for the "no such column: employee_id" startup crash.
 *
 * `npm run dev` used to die on any development database written before the
 * Employees module existed, because openDb() executed the whole SCHEMA script
 * — including `CREATE INDEX … ON asset_assignments(employee_id)` — before the
 * drift repair could add that column. This script rebuilds a database in that
 * pre-employee shape and checks that openDb() upgrades it in place:
 *
 *   • both employee_id columns are added,
 *   • the indexes over them are created,
 *   • existing rows survive,
 *   • a second boot is a no-op (the repair is idempotent).
 *
 * It runs against a throwaway directory (KU_AMS_MOCK_DATA_DIR), so the
 * database in mock-api/data is never touched.
 *
 * Usage: node scripts/schema-drift.spec.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const workDir = mkdtempSync(path.join(tmpdir(), 'ku-ams-drift-'))
process.env.KU_AMS_MOCK_DATA_DIR = workDir

// Imported after the env var is set, while the module still resolves DB_PATH.
const { SCHEMA, openDb, DB_PATH } = await import('../mock-api/db.js')

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures += 1
}

const columnsOf = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name)
const hasIndex = (db, name) =>
  !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(name)

// The SCHEMA of the revision that predates the Employees module: everything
// except the two employee_id columns, their foreign keys and their index.
const STALE_SCHEMA = SCHEMA.split('\n')
  .filter((line) => !/^\s*(employee_id INTEGER,|-- The assignee is an EMPLOYEE|-- legacy mirror|FOREIGN KEY \(employee_id\) REFERENCES|CREATE INDEX IF NOT EXISTS idx_assignments_employee)/.test(line))
  .join('\n')

// A database in the old shape, with one row the upgrade must not lose.
function createStaleDatabase() {
  const db = new DatabaseSync(DB_PATH)
  db.exec(STALE_SCHEMA)
  db.prepare(
    "INSERT INTO users (name, username, email, password_hash) VALUES ('Old User','olduser','old@ku.edu.af','x')",
  ).run()
  db.close()
}

function rebuildWithoutColumn(db, table, column) {
  const keep = db.prepare(`PRAGMA table_info("${table}")`).all().filter((c) => c.name !== column)
  const definitions = keep.map((c) => {
    const parts = [`"${c.name}"`, c.type || 'TEXT']
    if (c.pk === 1 && /INT/i.test(c.type || '')) parts.push('PRIMARY KEY AUTOINCREMENT')
    else if (c.notnull) parts.push('NOT NULL')
    if (c.dflt_value != null) parts.push(`DEFAULT ${c.dflt_value}`)
    return parts.join(' ')
  })
  const cols = keep.map((c) => `"${c.name}"`).join(', ')
  db.exec(`CREATE TABLE "${table}__stale" (${definitions.join(', ')})`)
  db.exec(`INSERT INTO "${table}__stale" (${cols}) SELECT ${cols} FROM "${table}"`)
  db.exec(`DROP TABLE "${table}"`)
  db.exec(`ALTER TABLE "${table}__stale" RENAME TO "${table}"`)
}

try {
  // ---------------------------------------------------------------- stale DB
  createStaleDatabase()
  const before = new DatabaseSync(DB_PATH, { readOnly: true })
  check('stale database has no assets.employee_id', !columnsOf(before, 'assets').includes('employee_id'))
  check('stale database has no asset_assignments.employee_id', !columnsOf(before, 'asset_assignments').includes('employee_id'))
  before.close()

  let db
  try {
    db = openDb()
    check('openDb() upgrades the stale database', true)
  } catch (err) {
    check('openDb() upgrades the stale database', false, err.message)
    throw err
  }

  check('assets.employee_id added', columnsOf(db, 'assets').includes('employee_id'))
  check('asset_assignments.employee_id added', columnsOf(db, 'asset_assignments').includes('employee_id'))
  check('idx_assignments_employee created', hasIndex(db, 'idx_assignments_employee'))
  check('idx_assets_employee created', hasIndex(db, 'idx_assets_employee'))
  check('existing rows preserved', db.prepare("SELECT COUNT(*) c FROM users WHERE username = 'olduser'").get().c === 1)
  check(
    'employee join works on the upgraded column',
    db.prepare('SELECT COUNT(*) c FROM assets a LEFT JOIN employees e ON e.id = a.employee_id').get().c >= 0,
  )
  db.close()

  // ------------------------------------------------------------- second boot
  try {
    db = openDb()
    check('second boot is a no-op', true)
    db.close()
  } catch (err) {
    check('second boot is a no-op', false, err.message)
  }

  // ------------------------------------- unrelated drift (generic repair)
  rmSync(DB_PATH, { force: true })
  rmSync(`${DB_PATH}-wal`, { force: true })
  rmSync(`${DB_PATH}-shm`, { force: true })
  const seeded = openDb()
  const reference = {}
  for (const table of ['assets', 'asset_assignments', 'employees', 'users', 'activity_logs']) {
    reference[table] = columnsOf(seeded, table)
  }
  const assetRows = seeded.prepare('SELECT COUNT(*) c FROM assets').get().c
  seeded.close()

  const stale = new DatabaseSync(DB_PATH)
  stale.exec('PRAGMA foreign_keys = OFF')
  for (const index of ['idx_assets_employee', 'idx_assignments_employee', 'idx_activity_logs']) {
    stale.exec(`DROP INDEX IF EXISTS ${index}`)
  }
  for (const [table, column] of [
    ['assets', 'employee_id'],
    ['asset_assignments', 'employee_id'],
    ['employees', 'manager_id'],
    ['users', 'avatar'],
    ['activity_logs', 'module'],
  ]) rebuildWithoutColumn(stale, table, column)
  stale.close()

  db = openDb()
  for (const [table, expected] of Object.entries(reference)) {
    const missing = expected.filter((column) => !columnsOf(db, table).includes(column))
    check(`${table}: every column restored`, missing.length === 0, missing.join(', '))
  }
  check('rows survive the generic repair', db.prepare('SELECT COUNT(*) c FROM assets').get().c === assetRows)
  db.close()

  console.log(failures === 0 ? '\nALL SCHEMA DRIFT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

process.exit(failures === 0 ? 0 : 1)

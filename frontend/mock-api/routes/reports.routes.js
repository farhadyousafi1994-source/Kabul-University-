import { ok, HttpError } from '../server.js'
import { log } from './crud.helper.js'
import { publicCatalog, DATASETS } from '../reports/catalog.js'
import { runReport, validateQuery, ReportError } from '../reports/engine.js'

/**
 * ---------------------------------------------------------------------------
 * Advanced Report Generator API (mirrors backend/routes/api/system.php)
 * ---------------------------------------------------------------------------
 *
 *   GET    /api/reports/catalog          data sources the caller may report on
 *   GET    /api/reports/lookups/:kind    filter value suggestions
 *   POST   /api/reports/query/validate   dry run — preview without executing
 *   POST   /api/reports/query            execute a validated Report Query
 *   GET    /api/reports/saved            saved reports (own + shared)
 *   POST   /api/reports/saved            save a report
 *   PUT    /api/reports/saved/:id        update / rename / re-share
 *   DELETE /api/reports/saved/:id        delete
 *   POST   /api/reports/saved/:id/run    run a saved report
 *   GET    /api/reports/schedules        scheduled deliveries
 *   POST   /api/reports/schedules        schedule a saved report
 *   PUT    /api/reports/schedules/:id    update
 *   DELETE /api/reports/schedules/:id    cancel
 *
 * The client never sends SQL: it sends a Report Query Object which is
 * validated against the server-side catalog allowlist before a single
 * parameterised SELECT is built (see ../reports/engine.js).
 * ---------------------------------------------------------------------------
 */

/** Translate an engine error into the API envelope the SPA expects. */
function guard(fn) {
  try {
    return fn()
  } catch (err) {
    if (err instanceof ReportError) throw new HttpError(err.status || 422, err.message, err.errors)
    throw err
  }
}

const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

/** Filter value suggestions — small, allowlisted lookup lists. */
const LOOKUPS = {
  categories: 'SELECT name AS value FROM asset_categories WHERE deleted_at IS NULL ORDER BY name',
  departments: 'SELECT name AS value FROM departments WHERE deleted_at IS NULL ORDER BY name',
  campuses: 'SELECT name AS value FROM campuses WHERE deleted_at IS NULL ORDER BY name',
  faculties: 'SELECT name AS value FROM faculties WHERE deleted_at IS NULL ORDER BY name',
  suppliers: 'SELECT name AS value FROM suppliers WHERE deleted_at IS NULL ORDER BY name',
  warehouses: 'SELECT name AS value FROM warehouses WHERE deleted_at IS NULL ORDER BY name',
  employees: "SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS value FROM employees WHERE deleted_at IS NULL ORDER BY first_name",
  brands: "SELECT DISTINCT brand AS value FROM assets WHERE brand IS NOT NULL AND brand <> '' ORDER BY brand",
}

const serialiseSaved = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  question: row.question || '',
  module: row.module,
  query: parseJson(row.query, {}),
  chart_type: row.chart_type || 'auto',
  locale: row.locale || null,
  is_shared: Boolean(row.is_shared),
  created_by: row.created_by,
  created_by_name: row.created_by_name || '',
  last_run_at: row.last_run_at,
  run_count: row.run_count || 0,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const serialiseSchedule = (row) => ({
  id: row.id,
  saved_report_id: row.saved_report_id,
  report_name: row.report_name || '',
  frequency: row.frequency,
  day_of_week: row.day_of_week,
  day_of_month: row.day_of_month,
  time_of_day: row.time_of_day,
  delivery: row.delivery,
  recipients: row.recipients || '',
  format: row.format,
  active: Boolean(row.active),
  next_run_at: row.next_run_at,
  last_run_at: row.last_run_at,
  created_at: row.created_at,
})

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly']
const DELIVERIES = ['notification', 'email', 'download']
const FORMATS = ['pdf', 'excel', 'csv']

/** Next fire time for a schedule — good enough for a development server. */
function nextRun(frequency, timeOfDay = '08:00', dayOfWeek = 1, dayOfMonth = 1, from = new Date()) {
  const [h, m] = String(timeOfDay).split(':').map((n) => Number(n) || 0)
  const next = new Date(from)
  next.setSeconds(0, 0)
  next.setHours(h, m, 0, 0)

  switch (frequency) {
    case 'daily':
      if (next <= from) next.setDate(next.getDate() + 1)
      break
    case 'weekly': {
      const delta = (Number(dayOfWeek) - next.getDay() + 7) % 7
      next.setDate(next.getDate() + (delta === 0 && next <= from ? 7 : delta))
      break
    }
    case 'quarterly': {
      const month = Math.floor(next.getMonth() / 3) * 3 + 3
      next.setMonth(month, Math.min(Number(dayOfMonth) || 1, 28))
      break
    }
    case 'monthly':
    default:
      next.setDate(Math.min(Number(dayOfMonth) || 1, 28))
      if (next <= from) next.setMonth(next.getMonth() + 1)
      break
  }
  return next.toISOString()
}

export function reportGeneratorRoutes(router) {
  // ---------------------------------------------------------------- catalog
  router.get('/api/reports/catalog', (ctx) => {
    const catalog = publicCatalog({ can: ctx.can })
    return ok('Report catalog retrieved successfully.', {
      ...catalog,
      permissions: {
        generate: ctx.can('reports.generate'),
        export: ctx.can('reports.export'),
        schedule: ctx.can('reports.schedule'),
        manage: ctx.can('reports.manage'),
        financial: ctx.can('reports.view_financial'),
        allBranches: ctx.can('reports.view_all_branches'),
      },
    })
  }, { auth: true, permission: 'reports.view' })

  // ---------------------------------------------------------------- lookups
  router.get('/api/reports/lookups/:kind', (ctx) => {
    const sql = LOOKUPS[ctx.params.kind]
    if (!sql) throw new HttpError(404, 'Unknown lookup list.')
    const values = ctx.db.prepare(sql).all().map((r) => r.value).filter(Boolean).slice(0, 300)
    return ok('Lookup retrieved successfully.', { kind: ctx.params.kind, values })
  }, { auth: true, permission: 'reports.view' })

  // --------------------------------------------------------------- validate
  // Dry run for the "Report Request" preview card: the query is validated and
  // normalised (defaults filled in, period resolved) but nothing is executed.
  router.post('/api/reports/query/validate', (ctx) => {
    const query = guard(() => validateQuery(ctx.body?.query ?? ctx.body, { can: ctx.can }))
    const ds = DATASETS[query.module]
    return ok('Report request is valid.', { query, moduleLabelKey: ds.labelKey })
  }, { auth: true, permission: 'reports.view' })

  // ------------------------------------------------------------------- run
  router.post('/api/reports/query', (ctx) => {
    const payload = guard(() => runReport(ctx.db, ctx.body?.query ?? ctx.body, { can: ctx.can, user: ctx.user }))
    return ok('Report generated successfully.', payload)
  }, { auth: true, permission: 'reports.generate|reports.view' })

  // ---------------------------------------------------------- saved reports
  router.get('/api/reports/saved', (ctx) => {
    const rows = ctx.db.prepare(
      `SELECT sr.*, u.name AS created_by_name
       FROM saved_reports sr
       LEFT JOIN users u ON u.id = sr.created_by
       WHERE sr.created_by = ? OR sr.is_shared = 1
       ORDER BY sr.updated_at DESC, sr.id DESC`,
    ).all(ctx.user.id)
    return ok('Saved reports retrieved successfully.', { data: rows.map(serialiseSaved) })
  }, { auth: true, permission: 'reports.view' })

  router.post('/api/reports/saved', (ctx) => {
    const body = ctx.body || {}
    const name = String(body.name || '').trim()
    if (!name) throw new HttpError(422, 'Validation failed', { name: ['A report name is required.'] })

    // Store the NORMALISED query so a saved report can never smuggle in
    // anything the catalog does not allow, even years later.
    const query = guard(() => validateQuery(body.query, { can: ctx.can }))
    const now = new Date().toISOString()

    const info = ctx.db.prepare(
      `INSERT INTO saved_reports (name, description, question, module, query, chart_type, locale, is_shared, created_by, run_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      name.slice(0, 120),
      String(body.description || '').slice(0, 500),
      String(body.question || '').slice(0, 500),
      query.module,
      JSON.stringify(query),
      query.chart || 'auto',
      String(body.locale || '').slice(0, 8) || null,
      body.is_shared ? 1 : 0,
      ctx.user.id,
      now,
      now,
    )

    const row = ctx.db.prepare('SELECT * FROM saved_reports WHERE id = ?').get(Number(info.lastInsertRowid))
    log(ctx, 'created', 'Reports', { id: row.id, name: row.name })
    return ok('Report saved successfully.', serialiseSaved(row), null, 201)
  }, { auth: true, permission: 'reports.generate|reports.view' })

  const ownedReport = (ctx, id) => {
    const row = ctx.db.prepare('SELECT * FROM saved_reports WHERE id = ?').get(Number(id))
    if (!row) throw new HttpError(404, 'Saved report not found.')
    if (row.created_by !== ctx.user.id && !ctx.can('reports.manage')) {
      throw new HttpError(403, 'You can only modify your own saved reports.')
    }
    return row
  }

  router.put('/api/reports/saved/:id', (ctx) => {
    const row = ownedReport(ctx, ctx.params.id)
    const body = ctx.body || {}
    const query = body.query ? guard(() => validateQuery(body.query, { can: ctx.can })) : parseJson(row.query, {})

    ctx.db.prepare(
      `UPDATE saved_reports SET name = ?, description = ?, question = ?, module = ?, query = ?, chart_type = ?, is_shared = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      String(body.name ?? row.name).slice(0, 120),
      String(body.description ?? row.description ?? '').slice(0, 500),
      String(body.question ?? row.question ?? '').slice(0, 500),
      query.module || row.module,
      JSON.stringify(query),
      body.chart_type || query.chart || row.chart_type,
      body.is_shared === undefined ? row.is_shared : (body.is_shared ? 1 : 0),
      new Date().toISOString(),
      row.id,
    )

    const updated = ctx.db.prepare('SELECT * FROM saved_reports WHERE id = ?').get(row.id)
    log(ctx, 'updated', 'Reports', { id: row.id, name: updated.name })
    return ok('Report updated successfully.', serialiseSaved(updated))
  }, { auth: true, permission: 'reports.view' })

  router.delete('/api/reports/saved/:id', (ctx) => {
    const row = ownedReport(ctx, ctx.params.id)
    ctx.db.prepare('DELETE FROM saved_reports WHERE id = ?').run(row.id)
    log(ctx, 'deleted', 'Reports', { id: row.id, name: row.name })
    return ok('Report deleted successfully.', { id: row.id })
  }, { auth: true, permission: 'reports.view' })

  router.post('/api/reports/saved/:id/run', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM saved_reports WHERE id = ?').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Saved report not found.')
    if (row.created_by !== ctx.user.id && !row.is_shared && !ctx.can('reports.manage')) {
      throw new HttpError(403, 'This report has not been shared with you.')
    }

    // Re-validated on every run: permissions may have changed since it was saved.
    const payload = guard(() => runReport(ctx.db, parseJson(row.query, {}), { can: ctx.can, user: ctx.user }))
    ctx.db.prepare('UPDATE saved_reports SET last_run_at = ?, run_count = run_count + 1 WHERE id = ?')
      .run(new Date().toISOString(), row.id)

    // Re-read so the client shows the new run count without a second request.
    const fresh = ctx.db.prepare(
      `SELECT sr.*, u.name AS created_by_name FROM saved_reports sr
       LEFT JOIN users u ON u.id = sr.created_by WHERE sr.id = ?`,
    ).get(row.id)

    return ok('Report generated successfully.', { ...payload, saved_report: serialiseSaved(fresh || row) })
  }, { auth: true, permission: 'reports.generate|reports.view' })

  // ------------------------------------------------------------- schedules
  router.get('/api/reports/schedules', (ctx) => {
    const rows = ctx.db.prepare(
      `SELECT rs.*, sr.name AS report_name
       FROM report_schedules rs
       LEFT JOIN saved_reports sr ON sr.id = rs.saved_report_id
       WHERE rs.created_by = ? OR ? = 1
       ORDER BY rs.next_run_at`,
    ).all(ctx.user.id, ctx.can('reports.manage') ? 1 : 0)
    return ok('Schedules retrieved successfully.', { data: rows.map(serialiseSchedule) })
  }, { auth: true, permission: 'reports.schedule|reports.view' })

  router.post('/api/reports/schedules', (ctx) => {
    const body = ctx.body || {}
    const errors = {}

    const savedReportId = Number(body.saved_report_id)
    const report = ctx.db.prepare('SELECT * FROM saved_reports WHERE id = ?').get(savedReportId)
    if (!report) errors.saved_report_id = ['Save the report before scheduling it.']

    const frequency = FREQUENCIES.includes(body.frequency) ? body.frequency : null
    if (!frequency) errors.frequency = ['Unsupported schedule frequency.']

    const delivery = DELIVERIES.includes(body.delivery) ? body.delivery : 'notification'
    const format = FORMATS.includes(body.format) ? body.format : 'pdf'
    const timeOfDay = /^\d{2}:\d{2}$/.test(String(body.time_of_day || '')) ? body.time_of_day : '08:00'
    if (Object.keys(errors).length) throw new HttpError(422, 'Validation failed', errors)

    const now = new Date().toISOString()
    const info = ctx.db.prepare(
      `INSERT INTO report_schedules (saved_report_id, frequency, day_of_week, day_of_month, time_of_day, delivery, recipients, format, active, next_run_at, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).run(
      savedReportId,
      frequency,
      body.day_of_week === undefined || body.day_of_week === null ? null : Number(body.day_of_week),
      body.day_of_month === undefined || body.day_of_month === null ? null : Number(body.day_of_month),
      timeOfDay,
      delivery,
      String(body.recipients || '').slice(0, 500),
      format,
      nextRun(frequency, timeOfDay, body.day_of_week, body.day_of_month),
      ctx.user.id,
      now,
      now,
    )

    const row = ctx.db.prepare(
      `SELECT rs.*, sr.name AS report_name FROM report_schedules rs
       LEFT JOIN saved_reports sr ON sr.id = rs.saved_report_id WHERE rs.id = ?`,
    ).get(Number(info.lastInsertRowid))
    log(ctx, 'created', 'Reports', { id: row.id, name: `Schedule — ${row.report_name}` })
    return ok('Report scheduled successfully.', serialiseSchedule(row), null, 201)
  }, { auth: true, permission: 'reports.schedule' })

  router.put('/api/reports/schedules/:id', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM report_schedules WHERE id = ?').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Schedule not found.')
    if (row.created_by !== ctx.user.id && !ctx.can('reports.manage')) throw new HttpError(403, 'You can only modify your own schedules.')

    const body = ctx.body || {}
    const frequency = FREQUENCIES.includes(body.frequency) ? body.frequency : row.frequency
    const timeOfDay = /^\d{2}:\d{2}$/.test(String(body.time_of_day || '')) ? body.time_of_day : row.time_of_day
    const active = body.active === undefined ? row.active : (body.active ? 1 : 0)

    ctx.db.prepare(
      `UPDATE report_schedules SET frequency = ?, day_of_week = ?, day_of_month = ?, time_of_day = ?,
              delivery = ?, recipients = ?, format = ?, active = ?, next_run_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      frequency,
      body.day_of_week === undefined ? row.day_of_week : Number(body.day_of_week),
      body.day_of_month === undefined ? row.day_of_month : Number(body.day_of_month),
      timeOfDay,
      DELIVERIES.includes(body.delivery) ? body.delivery : row.delivery,
      body.recipients === undefined ? row.recipients : String(body.recipients).slice(0, 500),
      FORMATS.includes(body.format) ? body.format : row.format,
      active,
      nextRun(frequency, timeOfDay, body.day_of_week ?? row.day_of_week, body.day_of_month ?? row.day_of_month),
      new Date().toISOString(),
      row.id,
    )

    const updated = ctx.db.prepare(
      `SELECT rs.*, sr.name AS report_name FROM report_schedules rs
       LEFT JOIN saved_reports sr ON sr.id = rs.saved_report_id WHERE rs.id = ?`,
    ).get(row.id)
    return ok('Schedule updated successfully.', serialiseSchedule(updated))
  }, { auth: true, permission: 'reports.schedule' })

  router.delete('/api/reports/schedules/:id', (ctx) => {
    const row = ctx.db.prepare('SELECT * FROM report_schedules WHERE id = ?').get(Number(ctx.params.id))
    if (!row) throw new HttpError(404, 'Schedule not found.')
    if (row.created_by !== ctx.user.id && !ctx.can('reports.manage')) throw new HttpError(403, 'You can only cancel your own schedules.')
    ctx.db.prepare('DELETE FROM report_schedules WHERE id = ?').run(row.id)
    return ok('Schedule cancelled successfully.', { id: row.id })
  }, { auth: true, permission: 'reports.schedule' })
}

export default reportGeneratorRoutes

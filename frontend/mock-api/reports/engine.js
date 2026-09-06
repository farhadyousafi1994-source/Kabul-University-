/**
 * ---------------------------------------------------------------------------
 * Report query engine — validate → authorise → build SQL → execute
 * ---------------------------------------------------------------------------
 *
 * The one and only path from a Report Query Object to the database.
 *
 *   validateQuery()  structural + allowlist + permission validation
 *   buildSql()       parameterised SELECT built from catalog SQL fragments
 *   runReport()      executes the (read-only) statement and shapes the payload
 *
 * Guarantees:
 *   · only SELECT statements are ever produced — there is no code path that
 *     can emit INSERT / UPDATE / DELETE / DDL / PRAGMA / ATTACH,
 *   · identifiers come exclusively from the server-side catalog; user input is
 *     only ever bound as a parameter,
 *   · every query carries a LIMIT (max 1000 rows) and a statement timeout,
 *   · datasets, metrics and fields the caller cannot read are rejected,
 *   · callers without `reports.view_all_branches` are transparently restricted
 *     to their own department.
 *
 * The module is dependency-free and synchronous so it can be unit-tested
 * without a database (see `tests/reportEngine.spec.js`).
 * ---------------------------------------------------------------------------
 */

import {
  DATASETS,
  DATE_PRESETS,
  CHART_TYPES,
  LIMITS,
  OPERATORS,
  TIME_DIMENSIONS,
  timeBucketSql,
  timeBucketLabelKey,
} from './catalog.js'

export class ReportError extends Error {
  constructor(message, errors = null, status = 422) {
    super(message)
    this.name = 'ReportError'
    this.errors = errors
    this.status = status
  }
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const uniq = (list) => [...new Set(list)]

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
const startOfWeek = (d) => addDays(d, -d.getDay()) // Sunday-first, matches the app's calendars

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Turn a named period into concrete `from`/`to` dates (inclusive, YYYY-MM-DD).
 * `now` is injectable so the resolution is deterministic in tests.
 */
export function resolveDateRange(preset, custom = {}, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const range = (from, to) => ({ preset, from: iso(from), to: iso(to) })

  switch (preset) {
    case 'today': return range(today, today)
    case 'yesterday': return range(addDays(today, -1), addDays(today, -1))
    case 'this_week': return range(startOfWeek(today), today)
    case 'last_week': return range(addDays(startOfWeek(today), -7), addDays(startOfWeek(today), -1))
    case 'this_month': return range(new Date(today.getFullYear(), today.getMonth(), 1), today)
    case 'last_month': return range(
      new Date(today.getFullYear(), today.getMonth() - 1, 1),
      new Date(today.getFullYear(), today.getMonth(), 0),
    )
    case 'this_quarter': return range(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), today)
    case 'this_year': return range(new Date(today.getFullYear(), 0, 1), today)
    case 'last_year': return range(new Date(today.getFullYear() - 1, 0, 1), new Date(today.getFullYear() - 1, 11, 31))
    case 'last_7_days': return range(addDays(today, -6), today)
    case 'last_30_days': return range(addDays(today, -29), today)
    case 'last_90_days': return range(addDays(today, -89), today)
    case 'last_6_months': return range(addMonths(today, -6), today)
    case 'last_12_months': return range(addMonths(today, -12), today)
    case 'next_30_days': return range(today, addDays(today, 30))
    case 'next_90_days': return range(today, addDays(today, 90))
    case 'all_time': return { preset, from: null, to: null }
    case 'custom': {
      const from = String(custom.from || '').slice(0, 10)
      const to = String(custom.to || '').slice(0, 10)
      if (from && !DATE_ONLY.test(from)) throw new ReportError('Invalid report request.', { 'filters.date_range.from': ['Expected YYYY-MM-DD.'] })
      if (to && !DATE_ONLY.test(to)) throw new ReportError('Invalid report request.', { 'filters.date_range.to': ['Expected YYYY-MM-DD.'] })
      if (!from && !to) return { preset: 'all_time', from: null, to: null }
      return { preset, from: from || null, to: to || null }
    }
    default:
      throw new ReportError('Invalid report request.', { 'filters.date_range': [`Unsupported period "${preset}".`] })
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate + normalise a Report Query Object against the catalog and the
 * caller's permissions. Returns a *new* object; the input is never mutated and
 * anything not explicitly allowed is dropped.
 *
 * @param {object} raw          the query as received from the client
 * @param {object} options
 * @param {(p:string)=>boolean} options.can  permission probe
 * @param {Date}   [options.now]             injectable clock
 */
export function validateQuery(raw, { can, now = new Date() } = {}) {
  if (!isPlainObject(raw)) throw new ReportError('Invalid report request.', { query: ['A report query object is required.'] })
  const allow = typeof can === 'function' ? can : () => false

  // -- module -------------------------------------------------------------
  const moduleId = String(raw.module || '').trim()
  const ds = DATASETS[moduleId]
  if (!ds) throw new ReportError('Invalid report request.', { module: [`Unknown data source "${moduleId || '—'}".`] })
  if (ds.permission && !allow(ds.permission)) {
    throw new ReportError('You are not allowed to report on this data source.', { module: ['Permission denied.'] }, 403)
  }

  const financial = allow('reports.view_financial')
  const errors = {}
  const push = (key, message) => { (errors[key] ||= []).push(message) }

  // -- mode ---------------------------------------------------------------
  const mode = raw.mode === 'detail' ? 'detail' : 'aggregate'

  // -- date field ---------------------------------------------------------
  const dateField = ds.dates?.[raw.dateField] ? raw.dateField : ds.defaultDate
  const dateExpr = ds.dates?.[dateField]?.expr || null

  // -- dimensions ---------------------------------------------------------
  const dimensions = []
  for (const id of Array.isArray(raw.dimensions) ? raw.dimensions.slice(0, 3) : []) {
    const key = String(id)
    if (TIME_DIMENSIONS.includes(key)) {
      if (!dateExpr) { push('dimensions', `"${key}" needs a date field this data source does not have.`); continue }
      dimensions.push(key)
    } else if (ds.dimensions[key]) {
      dimensions.push(key)
    } else {
      push('dimensions', `Unknown grouping "${key}".`)
    }
  }

  // -- metrics ------------------------------------------------------------
  const metrics = []
  for (const id of Array.isArray(raw.metrics) ? raw.metrics.slice(0, 6) : []) {
    const key = String(id)
    const def = ds.metrics[key]
    if (!def) { push('metrics', `Unknown metric "${key}".`); continue }
    if (def.financial && !financial) { push('metrics', `Metric "${key}" requires the financial reporting permission.`); continue }
    metrics.push(key)
  }

  // -- detail fields ------------------------------------------------------
  const fields = []
  for (const id of Array.isArray(raw.fields) ? raw.fields.slice(0, 20) : []) {
    const key = String(id)
    const def = ds.fields[key]
    if (!def) { push('fields', `Unknown field "${key}".`); continue }
    if (def.financial && !financial) continue // silently hidden, not an error
    fields.push(key)
  }

  // -- filters ------------------------------------------------------------
  const filters = {}
  let dateRange = null
  const rawFilters = isPlainObject(raw.filters) ? raw.filters : {}

  for (const [key, value] of Object.entries(rawFilters)) {
    if (key === 'date_range') {
      if (value == null) continue
      const spec = typeof value === 'string' ? { preset: value } : value
      if (!isPlainObject(spec)) { push('filters', 'Invalid period.'); continue }
      const preset = String(spec.preset || 'custom')
      if (!DATE_PRESETS.includes(preset)) { push('filters', `Unsupported period "${preset}".`); continue }
      try {
        dateRange = resolveDateRange(preset, spec, now)
      } catch (err) {
        Object.assign(errors, err.errors || {})
      }
      continue
    }

    const def = ds.filters[key]
    if (!def) { push('filters', `Unknown filter "${key}".`); continue }
    if (def.financial && !financial) { push('filters', `Filter "${key}" requires the financial reporting permission.`); continue }

    const spec = isPlainObject(value) ? value : { op: 'eq', value }
    const op = String(spec.op || 'eq')
    const allowed = OPERATORS[def.type] || OPERATORS.text
    if (!allowed.includes(op)) { push('filters', `Operator "${op}" is not allowed on "${key}".`); continue }

    let val = spec.value
    if (op === 'between') {
      const pair = Array.isArray(val) ? val : [spec.from, spec.to]
      if (pair.length !== 2 || pair.some((v) => v === undefined || v === null || v === '')) {
        push('filters', `"${key}" needs two values for a range.`)
        continue
      }
      val = pair.map(normaliseScalar)
    } else if (op === 'in') {
      const list = (Array.isArray(val) ? val : [val]).filter((v) => v !== undefined && v !== null && v !== '')
      if (!list.length) { push('filters', `"${key}" needs at least one value.`); continue }
      val = list.slice(0, 50).map(normaliseScalar)
    } else if (op === 'is_empty' || op === 'is_not_empty') {
      val = null
    } else {
      if (val === undefined || val === null || val === '') { push('filters', `"${key}" needs a value.`); continue }
      val = normaliseScalar(val)
      if ((def.type === 'number') && Number.isNaN(Number(val))) { push('filters', `"${key}" expects a number.`); continue }
    }

    // Enum filters may only carry values from the catalog's own option list.
    if (def.type === 'enum' && def.options) {
      const values = Array.isArray(val) ? val : [val]
      const bad = values.filter((v) => v !== null && !def.options.includes(String(v)))
      if (bad.length) { push('filters', `Unsupported value for "${key}": ${bad.join(', ')}.`); continue }
    }

    filters[key] = { op, value: val }
  }

  if (!dateRange) dateRange = { preset: 'all_time', from: null, to: null }

  // -- defaults for an under-specified query -------------------------------
  if (mode === 'aggregate') {
    if (!metrics.length) metrics.push(...(ds.defaults?.metrics || ['count']).filter((m) => ds.metrics[m] && (!ds.metrics[m].financial || financial)))
    if (!metrics.length) metrics.push(Object.keys(ds.metrics)[0])
    if (!dimensions.length) dimensions.push(...(ds.defaults?.dimensions || []).slice(0, 1))
  } else if (!fields.length) {
    fields.push(...(ds.defaults?.fields || Object.keys(ds.fields).slice(0, 6)).filter((f) => ds.fields[f] && (!ds.fields[f].financial || financial)))
  }

  // -- sort ---------------------------------------------------------------
  const sortable = mode === 'aggregate' ? [...metrics, ...dimensions] : fields
  let sort = null
  if (isPlainObject(raw.sort) && raw.sort.field) {
    const field = String(raw.sort.field)
    if (!sortable.includes(field)) push('sort', `Cannot sort by "${field}" — it is not part of this report.`)
    else sort = { field, direction: String(raw.sort.direction).toLowerCase() === 'asc' ? 'asc' : 'desc' }
  }
  if (!sort) {
    const fallback = mode === 'aggregate' ? (metrics[0] || dimensions[0]) : fields[0]
    sort = { field: fallback, direction: mode === 'aggregate' && metrics.length ? 'desc' : 'asc' }
  }

  // -- limit / chart ------------------------------------------------------
  const rawLimit = Number(raw.limit)
  const max = mode === 'detail' ? LIMITS.detailMax : LIMITS.max
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), max) : LIMITS.default
  const chart = CHART_TYPES.includes(raw.chart) ? raw.chart : 'auto'

  if (Object.keys(errors).length) throw new ReportError('Invalid report request.', errors)

  return {
    module: moduleId,
    mode,
    metrics: uniq(metrics),
    dimensions: uniq(dimensions),
    fields: uniq(fields),
    dateField,
    // The period is kept BOTH inside `filters` (so a saved report, a preview
    // card and the builder all read it from one place) and as `dateRange`
    // (already resolved to absolute boundaries for execution).
    filters: { ...filters, date_range: dateRange },
    dateRange,
    sort,
    limit,
    chart,
  }
}

function normaliseScalar(value) {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  return String(value).slice(0, 200)
}

// ---------------------------------------------------------------------------
// SQL building
// ---------------------------------------------------------------------------

/** Collect the join clauses a set of catalog entries needs, in declaration order. */
function joinsFor(ds, defs) {
  const wanted = new Set()
  for (const def of defs) for (const need of def?.needs || []) wanted.add(need)
  return Object.entries(ds.joins || {})
    .filter(([key]) => wanted.has(key))
    .map(([, clause]) => clause)
}

/** WHERE fragments + bound parameters for the validated filters. */
function whereFor(ds, query, scope) {
  const clauses = [...(ds.baseWhere || [])]
  const params = []
  const needs = []

  for (const [key, spec] of Object.entries(query.filters)) {
    // The period travels inside `filters` too (so a saved report keeps it in
    // one place) but it is applied below, against the active date column.
    if (key === 'date_range') continue
    const def = ds.filters[key]
    needs.push(def)
    const col = def.expr
    switch (spec.op) {
      case 'eq': clauses.push(`${col} = ?`); params.push(spec.value); break
      case 'neq': clauses.push(`(${col} IS NULL OR ${col} <> ?)`); params.push(spec.value); break
      case 'contains': clauses.push(`${col} LIKE ? ESCAPE '\\'`); params.push(`%${escapeLike(spec.value)}%`); break
      case 'not_contains': clauses.push(`(${col} IS NULL OR ${col} NOT LIKE ? ESCAPE '\\')`); params.push(`%${escapeLike(spec.value)}%`); break
      case 'starts_with': clauses.push(`${col} LIKE ? ESCAPE '\\'`); params.push(`${escapeLike(spec.value)}%`); break
      case 'gt': clauses.push(`${col} > ?`); params.push(spec.value); break
      case 'gte': clauses.push(`${col} >= ?`); params.push(spec.value); break
      case 'lt': clauses.push(`${col} < ?`); params.push(spec.value); break
      case 'lte': clauses.push(`${col} <= ?`); params.push(spec.value); break
      case 'between': clauses.push(`${col} BETWEEN ? AND ?`); params.push(spec.value[0], spec.value[1]); break
      case 'in': clauses.push(`${col} IN (${spec.value.map(() => '?').join(', ')})`); params.push(...spec.value); break
      case 'is_empty': clauses.push(`(${col} IS NULL OR ${col} = '')`); break
      case 'is_not_empty': clauses.push(`(${col} IS NOT NULL AND ${col} <> '')`); break
      default: break
    }
  }

  // Period — always applied against the dataset's active date column.
  const dateDef = ds.dates?.[query.dateField]
  if (dateDef && (query.dateRange.from || query.dateRange.to)) {
    needs.push(dateDef)
    if (query.dateRange.from) { clauses.push(`date(${dateDef.expr}) >= date(?)`); params.push(query.dateRange.from) }
    if (query.dateRange.to) { clauses.push(`date(${dateDef.expr}) <= date(?)`); params.push(query.dateRange.to) }
  }

  // Row-level scope — invisible to the client, never overridable by it.
  if (scope?.clause) {
    clauses.push(scope.clause)
    params.push(...scope.params)
    if (scope.def) needs.push(scope.def)
  }

  return { clauses, params, needs }
}

const escapeLike = (value) => String(value).replace(/[\\%_]/g, (m) => `\\${m}`)

/**
 * Row-level restriction for callers without `reports.view_all_branches`:
 * they only ever see their own department's data.
 */
export function scopeFor(ds, { can, user } = {}) {
  const allow = typeof can === 'function' ? can : () => false
  if (allow('reports.view_all_branches')) return null
  const column = ds.scope?.department
  if (!column) return null
  const departmentId = user?.department_id
  if (!departmentId) return null
  return {
    clause: `${column} = ?`,
    params: [departmentId],
    def: { needs: ds.scope.needs || [] },
    label: 'department',
  }
}

/**
 * Build the main SELECT for a validated query.
 * @returns {{ sql: string, params: any[], columns: object[] }}
 */
export function buildSql(query, { scope = null } = {}) {
  const ds = DATASETS[query.module]
  const dateExpr = ds.dates?.[query.dateField]?.expr
  const select = []
  const columns = []
  const usedDefs = []
  const groupBy = []

  if (query.mode === 'aggregate') {
    query.dimensions.forEach((id, index) => {
      const isTime = TIME_DIMENSIONS.includes(id)
      const def = isTime ? { needs: ds.dates?.[query.dateField]?.needs || [] } : ds.dimensions[id]
      const expr = isTime ? timeBucketSql(id, dateExpr) : def.expr
      usedDefs.push(def)
      select.push(`${expr} AS d${index}`)
      groupBy.push(String(index + 1))
      columns.push({
        key: `d${index}`,
        id,
        role: 'dimension',
        labelKey: isTime ? timeBucketLabelKey(id) : def.labelKey,
        type: isTime ? 'time' : 'text',
        translate: def.translate || null,
      })
    })

    query.metrics.forEach((id, index) => {
      const def = ds.metrics[id]
      usedDefs.push(def)
      select.push(`${def.expr} AS m${index}`)
      columns.push({ key: `m${index}`, id, role: 'metric', labelKey: def.labelKey, type: def.format || 'number' })
    })
  } else {
    query.fields.forEach((id, index) => {
      const def = ds.fields[id]
      usedDefs.push(def)
      select.push(`${def.expr} AS f${index}`)
      columns.push({
        key: `f${index}`,
        id,
        role: 'field',
        labelKey: def.labelKey,
        type: def.format || 'text',
        translate: def.translate || null,
      })
    })
  }

  const { clauses, params, needs } = whereFor(ds, query, scope)
  const joins = joinsFor(ds, [...usedDefs, ...needs])

  const sortColumn = columns.find((c) => c.id === query.sort.field)
  const orderBy = sortColumn ? `${sortColumn.key} ${query.sort.direction.toUpperCase()}` : null

  const sql = [
    `SELECT ${select.join(', ')}`,
    `FROM ${ds.from}`,
    ...joins,
    clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    groupBy.length ? `GROUP BY ${groupBy.join(', ')}` : '',
    orderBy ? `ORDER BY ${orderBy}` : '',
    `LIMIT ${query.limit}`,
  ].filter(Boolean).join('\n')

  return { sql, params, columns }
}

/** Grand totals for the summary cards — the same filters, without grouping. */
export function buildSummarySql(query, { scope = null } = {}) {
  const ds = DATASETS[query.module]
  const metricIds = query.mode === 'aggregate' ? query.metrics : []
  const select = metricIds.map((id, i) => `${ds.metrics[id].expr} AS m${i}`)
  select.push('COUNT(*) AS row_total')

  const { clauses, params, needs } = whereFor(ds, query, scope)
  const joins = joinsFor(ds, [...metricIds.map((id) => ds.metrics[id]), ...needs])

  const sql = [
    `SELECT ${select.join(', ')}`,
    `FROM ${ds.from}`,
    ...joins,
    clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
  ].filter(Boolean).join('\n')

  return { sql, params, metricIds }
}

/** Guard rail: the engine must only ever hand SELECTs to the driver. */
export function assertReadOnly(sql) {
  const normalised = String(sql).trim().toLowerCase()
  if (!normalised.startsWith('select')) throw new ReportError('Only read-only report queries are allowed.', null, 400)
  if (/;\s*\S/.test(sql)) throw new ReportError('Only a single read-only statement is allowed.', null, 400)
  if (/\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace)\b/i.test(sql)) {
    throw new ReportError('Only read-only report queries are allowed.', null, 400)
  }
  return true
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/**
 * Validate, authorise and run a report.
 *
 * @param {object} db    better-sqlite3 / node:sqlite handle
 * @param {object} raw   the Report Query Object from the client
 * @param {object} ctx   { can, user, now }
 */
export function runReport(db, raw, ctx = {}) {
  const started = Date.now()
  const query = validateQuery(raw, ctx)
  const ds = DATASETS[query.module]
  const scope = scopeFor(ds, ctx)

  const { sql, params, columns } = buildSql(query, { scope })
  assertReadOnly(sql)

  const rows = db.prepare(sql).all(...params).map((row) => {
    const out = {}
    for (const col of columns) out[col.key] = row[col.key] ?? null
    return out
  })

  let summary = []
  let rowTotal = rows.length
  if (query.mode === 'aggregate' && query.metrics.length) {
    const totals = buildSummarySql(query, { scope })
    assertReadOnly(totals.sql)
    const result = db.prepare(totals.sql).get(...totals.params) || {}
    rowTotal = Number(result.row_total || 0)
    summary = totals.metricIds.map((id, i) => ({
      id,
      labelKey: ds.metrics[id].labelKey,
      type: ds.metrics[id].format || 'number',
      value: result[`m${i}`] ?? 0,
    }))
  }

  return {
    query,
    columns,
    rows,
    summary,
    meta: {
      module: query.module,
      moduleLabelKey: ds.labelKey,
      mode: query.mode,
      generated_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      row_count: rows.length,
      total_rows: rowTotal,
      truncated: rows.length >= query.limit,
      scoped: Boolean(scope),
      scope: scope?.label || null,
      date_range: query.dateRange,
      chart: query.chart,
    },
  }
}

export { DATASETS, LIMITS }

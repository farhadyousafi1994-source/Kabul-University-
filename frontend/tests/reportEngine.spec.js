/**
 * Report engine — validation, authorisation and SQL generation.
 *
 * These tests are the security contract of the Advanced Report Generator:
 * nothing the client sends may reach the database unless the catalog knows
 * it, the user is allowed to see it, and the resulting statement is a single
 * read-only SELECT.
 */
import { describe, expect, it } from 'vitest'
import {
  ReportError,
  assertReadOnly,
  buildSql,
  buildSummarySql,
  resolveDateRange,
  scopeFor,
  validateQuery,
  DATASETS,
} from '../mock-api/reports/engine.js'
import { publicCatalog } from '../mock-api/reports/catalog.js'

const allow = () => true
const deny = (permission) => permission !== 'reports.view_financial' && permission !== 'reports.view_all_branches'

const baseQuery = (extra = {}) => ({
  module: 'assets',
  mode: 'aggregate',
  metrics: ['count'],
  dimensions: ['category'],
  filters: { date_range: { preset: 'all_time' } },
  ...extra,
})

describe('validateQuery — allowlists', () => {
  it('accepts a well-formed query and normalises it', () => {
    const query = validateQuery(baseQuery(), { can: allow })
    expect(query.module).toBe('assets')
    expect(query.metrics).toEqual(['count'])
    expect(query.dimensions).toEqual(['category'])
    expect(query.limit).toBeGreaterThan(0)
    expect(query.dateField).toBeTruthy()
  })

  it('rejects an unknown module', () => {
    expect(() => validateQuery(baseQuery({ module: 'salaries' }), { can: allow })).toThrow(ReportError)
  })

  it('rejects an unknown metric, dimension and filter', () => {
    for (const patch of [{ metrics: ['profit'] }, { dimensions: ['galaxy'] }, { filters: { hacker: { op: 'eq', value: 1 } } }]) {
      expect(() => validateQuery(baseQuery(patch), { can: allow })).toThrow(ReportError)
    }
  })

  it('rejects an operator the field type does not allow', () => {
    expect(() =>
      validateQuery(baseQuery({ filters: { status: { op: 'contains', value: 'act' } } }), { can: allow }),
    ).toThrow(ReportError)
  })

  it('rejects an enum value outside the catalog options', () => {
    expect(() =>
      validateQuery(baseQuery({ filters: { status: { op: 'eq', value: 'sold-on-ebay' } } }), { can: allow }),
    ).toThrow(ReportError)
  })

  it('never trusts a client-sent SQL fragment', () => {
    expect(() =>
      validateQuery(baseQuery({ metrics: ['count'], dimensions: ['category); DROP TABLE assets;--'] }), { can: allow }),
    ).toThrow(ReportError)
  })

  it('falls back to the dataset defaults when nothing is specified', () => {
    const query = validateQuery({ module: 'assets' }, { can: allow })
    expect(query.metrics.length + query.dimensions.length).toBeGreaterThan(0)
  })

  it('keeps the chosen period inside `filters` so previews and saved reports agree', () => {
    const query = validateQuery(baseQuery({ filters: { date_range: { preset: 'this_year' } } }), { can: allow })
    expect(query.filters.date_range.preset).toBe('this_year')
    expect(query.dateRange.preset).toBe('this_year')
    expect(query.dateRange.from).toBeTruthy()

    // …and the period is applied as two bound predicates, not as a filter id.
    const { sql, params } = buildSql(query, { scope: null })
    expect(sql.match(/date\(/g).length).toBeGreaterThanOrEqual(2)
    expect(params).toContain(query.dateRange.from)
    expect(params).toContain(query.dateRange.to)
  })

  it('caps the row limit', () => {
    const query = validateQuery(baseQuery({ limit: 999999 }), { can: allow })
    expect(query.limit).toBeLessThanOrEqual(1000)
  })
})

describe('validateQuery — permissions', () => {
  it('blocks financial metrics without reports.view_financial', () => {
    expect(() => validateQuery(baseQuery({ metrics: ['purchase_value'] }), { can: deny })).toThrow(ReportError)
    expect(() => validateQuery(baseQuery({ metrics: ['purchase_value'] }), { can: allow })).not.toThrow()
  })

  it('scopes rows to the user department without reports.view_all_branches', () => {
    const scope = scopeFor(DATASETS.assets, { can: deny, user: { department_id: 7 } })
    expect(scope).toBeTruthy()
    expect(scope.params).toContain(7)

    expect(scopeFor(DATASETS.assets, { can: allow, user: { department_id: 7 } })).toBeNull()
  })
})

describe('buildSql', () => {
  it('produces a single parameterised SELECT', () => {
    const query = validateQuery(
      baseQuery({ filters: { status: { op: 'eq', value: 'available' }, date_range: { preset: 'this_year' } } }),
      { can: allow },
    )
    const { sql, params, columns } = buildSql(query, { scope: null })

    expect(sql.trim().toUpperCase().startsWith('SELECT')).toBe(true)
    expect(sql).not.toMatch(/;\s*\w/)
    expect(sql).toContain('?')
    expect(params).toContain('available')
    expect(columns.map((c) => c.role)).toEqual(['dimension', 'metric'])
    expect(columns[0].labelKey).toMatch(/^reports\./)
  })

  it('escapes LIKE wildcards in a contains filter', () => {
    const query = validateQuery(baseQuery({ filters: { brand: { op: 'contains', value: '100%_x' } } }), { can: allow })
    const { sql, params } = buildSql(query, { scope: null })
    expect(sql).toContain("ESCAPE '\\'")
    expect(params.some((p) => String(p).includes('\\%'))).toBe(true)
  })

  it('adds the department predicate when the caller is scoped', () => {
    const query = validateQuery(baseQuery(), { can: allow })
    const scope = scopeFor(DATASETS.assets, { can: deny, user: { department_id: 3 } })
    const { sql, params } = buildSql(query, { scope })
    expect(sql).toMatch(/department_id\s*=\s*\?/)
    expect(params).toContain(3)
  })

  it('groups a time dimension by the selected date field', () => {
    const query = validateQuery(baseQuery({ dimensions: ['month'], dateField: 'purchase_date' }), { can: allow })
    const { sql, columns } = buildSql(query, { scope: null })
    expect(sql).toContain('purchase_date')
    expect(columns[0].type).toBe('time')
  })

  it('builds a summary statement with the same filters and no grouping', () => {
    const query = validateQuery(baseQuery({ filters: { status: { op: 'eq', value: 'available' } } }), { can: allow })
    const summary = buildSummarySql(query, { scope: null })
    expect(summary.sql).toContain('COUNT(*)')
    expect(summary.sql).not.toContain('GROUP BY')
    expect(summary.params).toContain('available')
    expect(summary.metricIds).toEqual(query.metrics)
  })
})

describe('assertReadOnly', () => {
  it('accepts a plain SELECT', () => {
    expect(() => assertReadOnly('SELECT 1 FROM assets')).not.toThrow()
  })

  it('rejects writes, DDL and stacked statements', () => {
    for (const sql of [
      'DELETE FROM assets',
      'UPDATE assets SET status = "x"',
      'DROP TABLE assets',
      'SELECT 1; DROP TABLE assets',
      'INSERT INTO assets (name) VALUES ("x")',
      'PRAGMA table_info(assets)',
    ]) {
      expect(() => assertReadOnly(sql), sql).toThrow()
    }
  })
})

describe('resolveDateRange', () => {
  const now = new Date('2026-06-15T10:00:00.000Z')

  it('resolves relative presets', () => {
    expect(resolveDateRange('today', {}, now).from.slice(0, 10)).toBe('2026-06-15')
    expect(resolveDateRange('this_year', {}, now).from.slice(0, 4)).toBe('2026')
    expect(resolveDateRange('last_30_days', {}, now).from < resolveDateRange('last_30_days', {}, now).to).toBe(true)
  })

  it('supports future windows for expiry reports', () => {
    const range = resolveDateRange('next_90_days', {}, now)
    expect(new Date(range.to) > now).toBe(true)
  })

  it('keeps an explicit custom range and falls back when it is empty', () => {
    expect(resolveDateRange('custom', { from: '2026-01-01', to: '2026-03-31' }, now).from).toContain('2026-01-01')
    expect(resolveDateRange('custom', {}, now).preset).toBe('all_time')
  })
})

describe('publicCatalog', () => {
  it('exposes ids and label keys only — never SQL', () => {
    const catalog = publicCatalog({ can: allow })
    const serialised = JSON.stringify(catalog)
    expect(serialised).not.toMatch(/SELECT|JOIN|COUNT\(|SUM\(/i)
    expect(catalog.modules.length).toBeGreaterThan(5)
    for (const mod of catalog.modules) {
      expect(mod.labelKey).toMatch(/^reports\./)
      for (const metric of mod.metrics) expect(metric.labelKey).toMatch(/^reports\./)
    }
  })

  it('hides financial metrics from users without the permission', () => {
    const restricted = publicCatalog({ can: deny })
    const assets = restricted.modules.find((m) => m.id === 'assets')
    expect(assets.metrics.some((m) => m.id === 'purchase_value')).toBe(false)
  })
})

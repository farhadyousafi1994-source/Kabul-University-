/**
 * Multilingual question understanding.
 *
 * The parser is a deterministic, offline rule engine: the same question always
 * produces the same Report Query Object, in English, Farsi, Dari, Pashto or
 * Arabic, and it can only ever emit ids that the catalog published — never a
 * table name, a column expression or SQL.
 */
import { describe, expect, it } from 'vitest'
import { publicCatalog } from '../mock-api/reports/catalog.js'
import { validateQuery } from '../mock-api/reports/engine.js'
import { applyClarification, describeQuery, normaliseText, parseQuestion } from '../src/utils/reportNlu.js'

const catalog = publicCatalog({ can: () => true })
const lookups = {
  categories: ['IT Equipment', 'Laboratory Equipment', 'Furniture'],
  suppliers: ['Dell Afghanistan', 'Kabul Office Supplies'],
  departments: ['Computer Science', 'Physics'],
  campuses: ['Main Campus'],
  warehouses: ['Central Warehouse'],
}
const now = new Date('2026-06-15T08:00:00.000Z')
const ask = (question) => parseQuestion(question, { catalog, lookups, now })

describe('normaliseText', () => {
  it('folds Arabic/Persian letter variants, digits and diacritics', () => {
    expect(normaliseText('كتگورى')).toBe(normaliseText('کتگوری'))
    expect(normaliseText('۹۰')).toBe('90')
    expect(normaliseText('  Assets   BY  Category ')).toBe('assets by category')
  })
})

describe('English questions', () => {
  it('understands "how many assets by category"', () => {
    const { query, confidence } = ask('How many assets do we have by category?')
    expect(query.module).toBe('assets')
    expect(query.dimensions).toContain('category')
    expect(query.metrics).toContain('count')
    expect(confidence).toBeGreaterThan(0.5)
  })

  it('understands maintenance cost by type this year', () => {
    const { query } = ask('Show maintenance cost by type this year')
    expect(query.module).toBe('maintenance')
    expect(query.metrics.some((m) => m.includes('cost'))).toBe(true)
    expect(query.filters.date_range.preset).toBe('this_year')
  })

  it('reads a top-N request into a limit and a descending sort', () => {
    const { query } = ask('top 5 suppliers by purchase value last 6 months')
    expect(query.limit).toBe(5)
    expect(query.sort.direction).toBe('desc')
    expect(query.filters.date_range.preset).toBe('last_6_months')
  })

  it('turns "expiring warranty in the next 90 days" into a future window', () => {
    const { query } = ask('Which assets have a warranty expiring in the next 90 days?')
    expect(query.module).toBe('assets')
    expect(query.dateField).toBe('warranty_expiry_date')
    expect(query.filters.date_range.preset).toBe('next_90_days')
  })

  it('detects a detail listing and an enum filter', () => {
    const { query } = ask('List all damaged assets')
    expect(query.module).toBe('assets')
    expect(query.mode).toBe('detail')
    expect(query.filters.status?.value === 'damaged' || query.filters.condition?.value === 'damaged').toBe(true)
  })

  it('matches a lookup value from the catalog', () => {
    const { query } = ask('assets by status in IT Equipment')
    expect(query.filters.category?.value).toBe('IT Equipment')
  })

  it('groups by month when a trend is requested', () => {
    const { query } = ask('Show the trend of purchase orders by month for the last 12 months')
    expect(query.dimensions).toContain('month')
    expect(query.chart).toBe('line')
  })
})

describe('Farsi / Dari, Pashto and Arabic questions', () => {
  it('parses Farsi', () => {
    const { query } = ask('تعداد دارایی‌ها بر اساس کتگوری')
    expect(query.module).toBe('assets')
    expect(query.dimensions).toContain('category')
  })

  it('parses Dari maintenance cost with a period', () => {
    const { query } = ask('مصرف ترمیم در سال جاری بر اساس نوع')
    expect(query.module).toBe('maintenance')
    expect(query.filters.date_range.preset).toBe('this_year')
  })

  it('parses Pashto', () => {
    const { query } = ask('د شتمنیو شمېر د کټګورۍ له مخې')
    expect(query.module).toBe('assets')
    expect(query.dimensions).toContain('category')
  })

  it('parses Arabic', () => {
    const { query } = ask('تكلفة الصيانة حسب النوع هذا العام')
    expect(query.module).toBe('maintenance')
    expect(query.filters.date_range.preset).toBe('this_year')
  })
})

describe('clarifying questions', () => {
  it('asks which data source when the question names none', () => {
    const parsed = ask('show me the best ones')
    expect(parsed.unresolved).toBe(true)
    expect(parsed.clarifications[0].id).toBe('module')
    expect(parsed.clarifications[0].questionKey).toMatch(/^reports\.clarify\./)
    for (const option of parsed.clarifications[0].options) expect(option.labelKey).toMatch(/^reports\./)
  })

  it('asks for a period when the question has no time reference', () => {
    const parsed = ask('maintenance cost by type')
    expect(parsed.clarifications.some((c) => c.id === 'period')).toBe(true)
  })

  it('applies a clarification answer to the draft query', () => {
    const parsed = ask('maintenance cost by type')
    const clarification = parsed.clarifications.find((c) => c.id === 'period')
    const next = applyClarification(parsed.query, clarification, 'this_month')
    expect(next.filters.date_range.preset).toBe('this_month')
  })
})

describe('safety', () => {
  it('ignores injected SQL and still produces a valid, catalog-only query', () => {
    const { query } = ask("assets by category'; DROP TABLE assets; --")
    expect(JSON.stringify(query)).not.toMatch(/DROP|SELECT|--/i)
    expect(() => validateQuery(query, { can: () => true })).not.toThrow()
  })

  it('every parsed question survives server validation', () => {
    const questions = [
      'How many assets do we have by category?',
      'Show maintenance cost by type this year',
      'Which suppliers have the highest purchase volume?',
      'Which assets have a warranty expiring in the next 90 days?',
      'Show assignments by department this year',
      'Compare purchase orders by month for the last six months',
      'List all damaged assets',
      'Show stock movements by warehouse this month',
      'تعداد دارایی‌ها بر اساس کتگوری',
      'د شتمنیو شمېر د کټګورۍ له مخې',
      'تكلفة الصيانة حسب النوع هذا العام',
    ]
    for (const question of questions) {
      const { query, unresolved } = ask(question)
      expect(unresolved, question).toBe(false)
      expect(() => validateQuery(query, { can: () => true }), question).not.toThrow()
    }
  })

  it('never leaks table or column expressions into the query object', () => {
    const { query } = ask('total purchase value by supplier this year')
    const serialised = JSON.stringify(query)
    expect(serialised).not.toMatch(/\bFROM\b|\bJOIN\b|SUM\(|a\.purchase_price/i)
  })
})

describe('describeQuery', () => {
  it('returns translation keys only, so the preview follows the locale', () => {
    const { query } = ask('maintenance cost by type this year')
    const lines = describeQuery(query, catalog)
    expect(lines.length).toBeGreaterThan(2)
    for (const line of lines) {
      expect(line.labelKey).toMatch(/^reports\./)
      if (line.valueKey) expect(line.valueKey).toMatch(/^reports\./)
      for (const key of line.valueKeys || []) expect(key).toMatch(/^reports\./)
    }
  })
})

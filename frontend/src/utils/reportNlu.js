/**
 * ---------------------------------------------------------------------------
 * Report NLU — "Ask Your Data" question → Report Query Object
 * ---------------------------------------------------------------------------
 *
 *   parseQuestion(text, { catalog, locale, lookups, now })
 *     → { query, confidence, matched, clarifications, unresolved }
 *
 * Pipeline (mirrors the documented architecture):
 *
 *   normalise text → detect module → detect metrics → detect grouping
 *   → detect period → detect filters (enum + named entities) → detect limit
 *   → decide table/chart shape → collect clarifying questions
 *
 * The result is ALWAYS a structured query object made of catalog ids. It never
 * contains SQL, table names or raw user text, and the server re-validates it
 * against its own allowlist before touching the database — the client is a
 * convenience layer, never the security boundary.
 *
 * The parser is deterministic and offline (no external AI service, nothing
 * leaves the installation) and is unit-tested in `tests/reportNlu.spec.js`.
 * A hosted LLM can later be plugged in as an additional *suggestion* source:
 * as long as it emits the same query object shape, every downstream guarantee
 * still holds.
 * ---------------------------------------------------------------------------
 */

import {
  MODULE_TERMS,
  METRIC_TERMS,
  MODULE_METRICS,
  DIMENSION_TERMS,
  TIME_DIMENSIONS,
  PERIOD_TERMS,
  INTENT_TERMS,
  VALUE_TERMS,
} from 'src/config/reportKeywords'

// ---------------------------------------------------------------------------
// Text normalisation — one shared transformation for lexicon and input
// ---------------------------------------------------------------------------

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Fold digits, Arabic/Persian letter variants, punctuation and whitespace. */
export function normaliseText(input) {
  let text = String(input ?? '').toLowerCase()

  // Eastern digits → Latin so "۹۰ روز" and "90 days" behave identically.
  text = text.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
             .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))

  // Letter folding: Arabic yeh/kaf/teh-marbuta → Persian forms, drop harakat.
  text = text.replace(/[يىۍے]/g, 'ی').replace(/[ك]/g, 'ک').replace(/[ة]/g, 'ه')
             .replace(/[أإآٱ]/g, 'ا').replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ی')
             .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
             .replace(/[\u200c\u200f\u200e]/g, ' ')

  // Punctuation → spaces (keep digits and letters of every script).
  text = text.replace(/[.,،؛;:!؟?()[\]{}"'`«»\-—_/\\|]/g, ' ')

  return text.replace(/\s+/g, ' ').trim()
}

/** Whole-token-ish containment test (spaces guard against partial matches). */
function hits(haystack, term) {
  if (!term) return 0
  const padded = ` ${haystack} `
  const needle = ` ${term} `
  if (padded.includes(needle)) return term.length
  // Allow suffixed forms in agglutinative scripts (e.g. "ماهانه" vs "ماه").
  if (term.length >= 4 && padded.includes(` ${term}`)) return term.length - 1
  return 0
}

/** Best-scoring key of a `{ key: [terms] }` dictionary. */
function bestMatch(text, dictionary, filterKeys = null) {
  let winner = null
  let score = 0
  for (const [key, terms] of Object.entries(dictionary)) {
    if (filterKeys && !filterKeys.includes(key)) continue
    for (const term of terms) {
      const s = hits(text, normaliseText(term))
      if (s > score) { score = s; winner = key }
    }
  }
  return { key: winner, score }
}

/**
 * Words that name a VALUE ("damaged", "lost", "pending", "مفقود") rather than
 * a subject. They are matched as filters later on, so they must not decide
 * which data source a question is about: "list all damaged assets" is a
 * question about assets, not about incidents.
 */
const WEAK_TERMS = new Set(
  VALUE_TERMS.flatMap((entry) => entry.terms).map((term) => normaliseText(term)),
)
const WEAK_WEIGHT = 0.4

/** All matching keys, strongest first. */
function allMatches(text, dictionary, filterKeys = null, { weakTerms = null } = {}) {
  const scored = []
  for (const [key, terms] of Object.entries(dictionary)) {
    if (filterKeys && !filterKeys.includes(key)) continue
    let best = 0
    for (const term of terms) {
      const normalised = normaliseText(term)
      const score = hits(text, normalised) * (weakTerms?.has(normalised) ? WEAK_WEIGHT : 1)
      best = Math.max(best, score)
    }
    if (best) scored.push({ key, score: best })
  }
  return scored.sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// Relative periods expressed with a number ("last 45 days", "۶ ماه اخیر")
// ---------------------------------------------------------------------------

const NUMBER_PERIOD = /(?:last|past|previous|next|coming|within|گذشته|اخیر|قبل|آینده|اینده|راتلونکي|وروستي|اخر|خلال|القادمه)?\s*(\d{1,3})\s*(day|days|week|weeks|month|months|year|years|روز|هفته|ماه|سال|ورځ|ورځې|اونۍ|میاشت|میاشتې|کال|یوم|ایام|اسبوع|شهر|اشهر|سنه)/

const FUTURE_HINTS = ['next', 'coming', 'within', 'upcoming', 'آینده', 'اینده', 'راتلونکي', 'القادمه', 'خلال', 'المقبله']

function numericPeriod(text) {
  const match = NUMBER_PERIOD.exec(text)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null

  const unit = match[2]
  const future = FUTURE_HINTS.some((h) => text.includes(normaliseText(h)))
  const days = /day|روز|ورځ|یوم|ایام/.test(unit) ? amount
    : /week|هفته|اونۍ|اسبوع/.test(unit) ? amount * 7
      : /month|ماه|میاشت|شهر|اشهر/.test(unit) ? amount * 30
        : amount * 365

  if (future) {
    if (days <= 30) return 'next_30_days'
    return 'next_90_days'
  }
  if (days <= 7) return 'last_7_days'
  if (days <= 30) return 'last_30_days'
  if (days <= 90) return 'last_90_days'
  if (days <= 183) return 'last_6_months'
  if (days <= 366) return 'last_12_months'
  return 'all_time'
}

/** "top 10", "بهترین ۵", "أفضل 20" → 10 / 5 / 20. */
function detectLimit(text) {
  const match = /(?:top|first|best|highest|lowest|بهترین|بیشترین|اولین|کمترین|غوره|اعلی|افضل|اکثر|اقل)\s*(\d{1,3})/.exec(text)
    || /(\d{1,3})\s*(?:top|best|بهترین|برتر|اول|غوره)/.exec(text)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : null
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 50

/**
 * @param {string} question       what the user typed, in any supported language
 * @param {object} options
 * @param {object} options.catalog  the catalog payload from GET /api/reports/catalog
 * @param {object} [options.lookups] { categories: [...], suppliers: [...], … }
 * @param {Date}   [options.now]
 */
export function parseQuestion(question, { catalog, lookups = {}, now = new Date() } = {}) {
  const text = normaliseText(question)
  const modules = catalog?.modules || []
  const matched = { terms: [] }
  const clarifications = []

  if (!text || !modules.length) {
    return { query: null, confidence: 0, matched, clarifications, unresolved: true }
  }

  const availableModuleIds = modules.map((m) => m.id)

  // -- 1. intent flags -----------------------------------------------------
  const intents = {}
  for (const [name, terms] of Object.entries(INTENT_TERMS)) {
    intents[name] = terms.some((term) => hits(text, normaliseText(term)) > 0)
  }

  // -- 2. module -----------------------------------------------------------
  const moduleMatches = allMatches(text, MODULE_TERMS, availableModuleIds, { weakTerms: WEAK_TERMS })
  let moduleId = moduleMatches[0]?.key || null

  // "expiring warranty" style questions are always about the asset register.
  if (!moduleId && intents.expiring && availableModuleIds.includes('assets')) moduleId = 'assets'
  if (!moduleId && intents.overdue && availableModuleIds.includes('assignments')) moduleId = 'assignments'
  if (!moduleId) {
    return {
      query: null,
      confidence: 0,
      matched,
      unresolved: true,
      clarifications: [{
        id: 'module',
        questionKey: 'reports.clarify.whichData',
        options: modules.slice(0, 6).map((m) => ({ value: m.id, labelKey: m.labelKey })),
      }],
    }
  }

  const mod = modules.find((m) => m.id === moduleId)
  matched.module = moduleId
  const dimensionIds = mod.dimensions.map((d) => d.id)
  const metricIds = mod.metrics.map((m) => m.id)
  const filterDefs = mod.filters || []

  // -- 3. metrics ----------------------------------------------------------
  const buckets = allMatches(text, METRIC_TERMS)
  const metricMap = MODULE_METRICS[moduleId] || {}
  const metrics = []
  for (const { key } of buckets) {
    const metric = metricMap[key]
    if (metric && metricIds.includes(metric) && !metrics.includes(metric)) metrics.push(metric)
  }
  if (!metrics.length) {
    const fallback = (mod.defaults?.metrics || []).filter((m) => metricIds.includes(m))
    metrics.push(...(fallback.length ? fallback : metricIds.slice(0, 1)))
  }
  matched.metrics = [...metrics]

  // -- 4. grouping ---------------------------------------------------------
  const dimensionMatches = allMatches(text, DIMENSION_TERMS, [...dimensionIds, ...TIME_DIMENSIONS])
  const dimensions = dimensionMatches
    .map((d) => d.key)
    .filter((id) => dimensionIds.includes(id) || TIME_DIMENSIONS.includes(id))
    .slice(0, 2)

  // A trend question always gets a time bucket, even if none was spelled out.
  if (intents.trend && !dimensions.some((d) => TIME_DIMENSIONS.includes(d))) dimensions.unshift('month')
  if (!dimensions.length && !intents.list) dimensions.push(...(mod.defaults?.dimensions || []).slice(0, 1))
  matched.dimensions = [...dimensions]

  // -- 5. period -----------------------------------------------------------
  const explicitPeriod = bestMatch(text, PERIOD_TERMS)
  const numeric = numericPeriod(text)
  let preset = explicitPeriod.key || numeric || null
  matched.period = preset

  // -- 6. date field -------------------------------------------------------
  let dateField = mod.defaultDate
  const dateIds = (mod.dates || []).map((d) => d.id)
  if (intents.expiring && dateIds.includes('warranty_expiry_date')) {
    dateField = 'warranty_expiry_date'
    if (!preset) preset = 'next_90_days'
  }
  if (intents.overdue && dateIds.includes('expected_return_date')) dateField = 'expected_return_date'

  // -- 7. filters ----------------------------------------------------------
  const filters = {}

  for (const entry of VALUE_TERMS) {
    const def = filterDefs.find((f) => f.id === entry.filter)
    if (!def || !(def.options || []).includes(entry.value)) continue
    if (entry.terms.some((term) => hits(text, normaliseText(term)) > 0)) {
      filters[entry.filter] = { op: 'eq', value: entry.value }
    }
  }

  // Named entities: match real category / supplier / department / warehouse
  // names from the lookup lists, so "in Kabul Main Campus" becomes a filter.
  for (const def of filterDefs) {
    if (!def.lookup || filters[def.id]) continue
    const values = lookups[def.lookup] || []
    let best = null
    for (const value of values) {
      const normalised = normaliseText(value)
      if (normalised.length < 3) continue
      if (hits(text, normalised) && (!best || normalised.length > normaliseText(best).length)) best = value
    }
    if (best) {
      filters[def.id] = { op: 'eq', value: best }
      matched.terms.push(best)
    }
  }
  matched.filters = { ...filters }

  // -- 8. shape ------------------------------------------------------------
  const wantsDetail = intents.list || intents.expiring || intents.overdue
  const mode = wantsDetail && !dimensionMatches.length ? 'detail' : 'aggregate'
  const limit = detectLimit(text) || (mode === 'detail' ? 100 : DEFAULT_LIMIT)

  const sortDirection = intents.bottom ? 'asc' : 'desc'
  const sortField = mode === 'aggregate' ? metrics[0] : null

  const timeDimension = dimensions.find((d) => TIME_DIMENSIONS.includes(d))
  const chart = mode === 'detail' ? 'table'
    : timeDimension ? 'line'
      : dimensions.length && metrics.length === 1 && ['status', 'condition', 'type', 'method'].includes(dimensions[0]) ? 'donut'
        : 'bar'

  const query = {
    module: moduleId,
    mode,
    metrics: mode === 'aggregate' ? metrics : [],
    dimensions: mode === 'aggregate' ? dimensions : [],
    fields: mode === 'detail' ? (mod.defaults?.fields || []) : [],
    dateField,
    filters: { ...filters, date_range: { preset: preset || 'all_time' } },
    sort: sortField ? { field: sortField, direction: sortDirection } : null,
    limit,
    chart,
  }

  // -- 9. clarifying questions --------------------------------------------
  // Only asked when the answer would actually change the report.
  if (!preset && dateIds.length) {
    clarifications.push({
      id: 'period',
      questionKey: 'reports.clarify.whichPeriod',
      apply: 'date_range',
      options: ['today', 'this_week', 'this_month', 'this_year', 'last_12_months', 'all_time']
        .map((value) => ({ value, labelKey: `reports.periods.${camel(value)}` })),
    })
  }

  if ((intents.top || intents.bottom) && buckets.length === 0 && metricIds.length > 1) {
    clarifications.push({
      id: 'metric',
      questionKey: 'reports.clarify.whichMetric',
      apply: 'metric',
      options: mod.metrics.slice(0, 5).map((m) => ({ value: m.id, labelKey: m.labelKey })),
    })
  }

  if (mode === 'aggregate' && !dimensions.length) {
    clarifications.push({
      id: 'dimension',
      questionKey: 'reports.clarify.howToGroup',
      apply: 'dimension',
      options: [...mod.dimensions.slice(0, 4), { id: 'month', labelKey: 'reports.fields.month' }]
        .map((d) => ({ value: d.id, labelKey: d.labelKey })),
    })
  }

  // -- 10. confidence ------------------------------------------------------
  let confidence = 0.35
  if (moduleMatches.length) confidence += 0.25
  if (buckets.length) confidence += 0.15
  if (dimensionMatches.length) confidence += 0.15
  if (preset) confidence += 0.1
  if (Object.keys(filters).length) confidence += 0.05
  confidence = Math.min(1, Number(confidence.toFixed(2)))

  return { query, confidence, matched, clarifications, unresolved: false, intents, now }
}

const camel = (snake) => String(snake).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

/** Apply a clarification answer to a draft query. */
export function applyClarification(query, clarification, value) {
  const next = { ...query, filters: { ...(query.filters || {}) } }
  switch (clarification.apply || clarification.id) {
    case 'date_range':
      next.filters.date_range = { preset: value }
      break
    case 'metric':
      next.metrics = [value]
      next.sort = { field: value, direction: next.sort?.direction || 'desc' }
      break
    case 'dimension':
      next.dimensions = [value]
      break
    case 'module':
      next.module = value
      break
    default:
      break
  }
  return next
}

/** Human-readable summary of a query, as translation keys + params. */
export function describeQuery(query, catalog) {
  if (!query) return []
  const mod = (catalog?.modules || []).find((m) => m.id === query.module)
  const label = (list, id) => list?.find((entry) => entry.id === id)?.labelKey || id

  const lines = [
    { labelKey: 'reports.preview.dataSource', valueKey: mod?.labelKey || query.module },
    { labelKey: 'reports.preview.period', valueKey: `reports.periods.${camel(query.filters?.date_range?.preset || 'all_time')}` },
  ]

  if (query.mode === 'aggregate') {
    lines.push({
      labelKey: 'reports.preview.metrics',
      valueKeys: query.metrics.map((m) => label(mod?.metrics, m)),
    })
    if (query.dimensions.length) {
      lines.push({
        labelKey: 'reports.preview.groupBy',
        valueKeys: query.dimensions.map((d) => label(mod?.dimensions, d)),
      })
    }
  } else {
    lines.push({
      labelKey: 'reports.preview.columns',
      valueKeys: query.fields.map((f) => label(mod?.fields, f)),
    })
  }

  const activeFilters = Object.entries(query.filters || {}).filter(([key]) => key !== 'date_range')
  if (activeFilters.length) {
    lines.push({
      labelKey: 'reports.preview.filters',
      values: activeFilters.map(([key, spec]) => ({
        labelKey: label(mod?.filters, key),
        value: Array.isArray(spec.value) ? spec.value.join(' – ') : String(spec.value ?? ''),
        op: spec.op,
      })),
    })
  }

  lines.push({ labelKey: 'reports.preview.rowLimit', value: query.limit })
  return lines
}

export default parseQuestion

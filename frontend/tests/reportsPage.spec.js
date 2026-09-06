/**
 * ---------------------------------------------------------------------------
 * Reports — multilingual rendering of a generated report
 * ---------------------------------------------------------------------------
 *
 * The requirement is that switching the language updates the Reports screen
 * IMMEDIATELY, without a reload and without re-fetching the report: the API
 * payload carries data and label keys only, so column headers, summary cards,
 * insights and every button must re-render from the locale files alone, while
 * the report itself (its rows, filters and selections) stays untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Quasar } from 'quasar'
import i18n from 'src/i18n'

vi.mock('src/utils/notify', () => {
  const notify = {
    success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), apiError: vi.fn((e) => e),
  }
  return { notify, default: notify, tt: (k) => k }
})

// QTabs measures its scroll area; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { useAuthStore } from 'src/stores/auth'
import ReportResult from 'src/components/reports/ReportResult.vue'
import { reportsExtensions } from 'src/i18n/reports.extensions'

/** A payload shaped exactly like POST /api/reports/query. */
const RESULT = {
  query: {
    module: 'assets',
    mode: 'aggregate',
    metrics: ['count'],
    dimensions: ['category'],
    filters: { date_range: { preset: 'this_year' }, status: { op: 'eq', value: 'available' } },
    limit: 50,
    chart: 'auto',
  },
  columns: [
    { key: 'd0', id: 'category', role: 'dimension', labelKey: 'reports.fields.category', type: 'text', translate: null },
    { key: 'm0', id: 'count', role: 'metric', labelKey: 'reports.metrics.assetCount', type: 'integer' },
    { key: 'm1', id: 'purchase_value', role: 'metric', labelKey: 'reports.metrics.purchaseValue', type: 'currency' },
  ],
  rows: [
    { d0: 'IT Equipment', m0: 12, m1: 645000 },
    { d0: 'Furniture', m0: 6, m1: 120000 },
    { d0: 'Laboratory Equipment', m0: 3, m1: 991000 },
  ],
  summary: [
    { id: 'count', labelKey: 'reports.metrics.assetCount', type: 'integer', value: 21 },
    { id: 'purchase_value', labelKey: 'reports.metrics.purchaseValue', type: 'currency', value: 1756000 },
  ],
  meta: {
    module: 'assets',
    moduleLabelKey: 'reports.modules.assets',
    mode: 'aggregate',
    generated_at: '2026-06-15T08:00:00.000Z',
    duration_ms: 3,
    row_count: 3,
    total_rows: 21,
    truncated: false,
    scoped: false,
    date_range: { preset: 'this_year' },
    chart: 'auto',
  },
}

function mountResult() {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.user = { id: 1, name: 'Maryam Nazari', roles: [{ name: 'Super Admin', permissions: [] }], permissions: [] }
  auth.token = 'test-token'

  return mount(ReportResult, {
    props: { result: RESULT, chartType: 'auto', canExport: true, canSave: true, canSchedule: true },
    global: {
      plugins: [[Quasar, { plugins: {} }], i18n],
      stubs: { apexchart: true, routerLink: true },
    },
    attachTo: document.body,
  })
}

describe('Reports — locale coverage', () => {
  it('ships the reports namespace for every supported language', () => {
    for (const locale of ['en', 'fa', 'ps', 'ar']) {
      expect(reportsExtensions[locale], locale).toBeTruthy()
      expect(reportsExtensions[locale].reports.title, locale).toBeTruthy()
    }
  })

  it('keeps the four languages key-for-key identical, so nothing falls back silently', () => {
    const flatten = (obj, prefix = '') =>
      Object.entries(obj).flatMap(([key, value]) =>
        value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`])

    const english = flatten(reportsExtensions.en).sort()
    for (const locale of ['fa', 'ps', 'ar']) {
      expect(flatten(reportsExtensions[locale]).sort(), locale).toEqual(english)
    }
  })

  it('exposes no hardcoded English inside the Farsi, Pashto or Arabic bundles', () => {
    for (const locale of ['fa', 'ps', 'ar']) {
      const values = JSON.stringify(reportsExtensions[locale].reports)
      // A stray English sentence would show up as several ASCII words in a row.
      expect(values.match(/[A-Za-z]{4,}\s+[A-Za-z]{4,}\s+[A-Za-z]{4,}/g) || [], locale).toEqual([])
    }
  })
})

describe('ReportResult — instant language switch', () => {
  beforeEach(() => { i18n.global.locale.value = 'en' })

  it('renders translated column headers, summary cards and insights', async () => {
    const wrapper = mountResult()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Category')
    expect(text).toContain('Purchase value')
    expect(text).toContain('IT Equipment')
    expect(text).toContain('Key insights')
    wrapper.unmount()
  })

  it('re-renders in Farsi without touching the data', async () => {
    const wrapper = mountResult()
    await flushPromises()
    expect(wrapper.text()).toContain('Category')

    i18n.global.locale.value = 'fa'
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain(reportsExtensions.fa.reports.fields.category)
    expect(text).toContain(reportsExtensions.fa.reports.insights.title)
    expect(text).not.toContain('Key insights')
    // The rows themselves are untouched — no refetch, no lost state.
    expect(text).toContain('IT Equipment')
    expect(wrapper.props('result')).toStrictEqual(RESULT)
    wrapper.unmount()
  })

  it('re-renders in Pashto and Arabic too', async () => {
    const wrapper = mountResult()
    await flushPromises()

    for (const locale of ['ps', 'ar']) {
      i18n.global.locale.value = locale
      await flushPromises()
      expect(wrapper.text(), locale).toContain(reportsExtensions[locale].reports.fields.category)
      expect(wrapper.text(), locale).toContain(reportsExtensions[locale].reports.insights.title)
    }
    wrapper.unmount()
  })

  it('always offers the Excel export as a green, spreadsheet-icon button', async () => {
    const wrapper = mountResult()
    await flushPromises()

    const excel = wrapper.find('[data-cy="export-excel"]')
    expect(excel.exists()).toBe(true)
    expect(excel.classes().join(' ')).toContain('app-btn--intent-excel')
    wrapper.unmount()
  })

  it('uses the shared button class every toolbar in the app relies on', async () => {
    const wrapper = mountResult()
    await flushPromises()
    expect(wrapper.findAll('button.ab-btn').length).toBeGreaterThan(3)
    wrapper.unmount()
  })
})

// ---------------------------------------------------------------------------
// Whole-page smoke test: the four tabs, the question → preview → generate
// pipeline, and the promise that no request ever carries SQL.
// ---------------------------------------------------------------------------

const catalogMock = vi.fn()
const lookupMock = vi.fn()
const validateMock = vi.fn()
const runMock = vi.fn()
const savedListMock = vi.fn()
const scheduleListMock = vi.fn()

vi.mock('src/services/reports.service', () => ({
  reportGeneratorService: {
    catalog: (...a) => catalogMock(...a),
    lookup: (...a) => lookupMock(...a),
    validate: (...a) => validateMock(...a),
    run: (...a) => runMock(...a),
    saved: {
      list: (...a) => savedListMock(...a),
      create: vi.fn(), update: vi.fn(), remove: vi.fn(), run: vi.fn(),
    },
    schedules: {
      list: (...a) => scheduleListMock(...a),
      create: vi.fn(), update: vi.fn(), remove: vi.fn(),
    },
  },
  default: {},
}))

vi.mock('src/services/system.service', () => ({
  reportService: {
    list: vi.fn(async () => ({ data: { data: [{ name: 'asset_register', title: 'Asset Register', description: 'All assets' }] } })),
    get: vi.fn(async () => ({ data: { title: 'Asset Register', rows: [] } })),
    exportUrl: (name) => `/api/reports/${name}/export`,
  },
}))

describe('ReportsPage — question to report', () => {
  beforeEach(async () => {
    i18n.global.locale.value = 'en'
    const { publicCatalog } = await import('../mock-api/reports/catalog.js')
    const payload = { ...publicCatalog({ can: () => true }), permissions: { generate: true, export: true, schedule: true, manage: true, financial: true, allBranches: true } }
    catalogMock.mockResolvedValue({ data: payload })
    lookupMock.mockResolvedValue({ data: { values: [] } })
    validateMock.mockImplementation(async (query) => ({ data: { query, moduleLabelKey: 'reports.modules.assets' } }))
    runMock.mockResolvedValue({ data: RESULT })
    savedListMock.mockResolvedValue({ data: { data: [] } })
    for (const spy of [catalogMock, validateMock, runMock, savedListMock, scheduleListMock]) spy.mockClear()
    scheduleListMock.mockResolvedValue({ data: { data: [] } })
  })

  async function mountPage() {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = { id: 1, name: 'Maryam Nazari', roles: [{ name: 'Super Admin', permissions: [] }], permissions: [] }
    auth.token = 'test-token'

    const ReportsPage = (await import('src/pages/Reports/ReportsPage.vue')).default
    const wrapper = mount(ReportsPage, {
      global: { plugins: [[Quasar, { plugins: {} }], i18n], stubs: { apexchart: true, routerLink: true } },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders the four tabs with translated labels', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    for (const tab of ['ask', 'builder', 'saved', 'standard']) {
      expect(text, tab).toContain(reportsExtensions.en.reports.tabs[tab])
    }
    wrapper.unmount()
  })

  it('parses a question, previews the request and only then runs it', async () => {
    const wrapper = await mountPage()

    const box = wrapper.find('textarea')
    await box.setValue('How many assets do we have by category this year?')
    await wrapper.find('[data-cy="ask-generate"]').trigger('click')
    await flushPromises()

    // The preview is shown BEFORE anything is executed.
    expect(validateMock).toHaveBeenCalledTimes(1)
    expect(runMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(reportsExtensions.en.reports.preview.title)

    await wrapper.find('[data-cy="preview-generate"]').trigger('click')
    await flushPromises()

    expect(runMock).toHaveBeenCalledTimes(1)
    const sent = runMock.mock.calls[0][0]
    expect(sent.module).toBe('assets')
    expect(JSON.stringify(sent)).not.toMatch(/select|from |join|;/i)
    expect(wrapper.text()).toContain('IT Equipment')
    wrapper.unmount()
  })

  it('keeps the generated report when the language changes', async () => {
    const wrapper = await mountPage()
    await wrapper.find('textarea').setValue('How many assets do we have by category this year?')
    await wrapper.find('[data-cy="ask-generate"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-cy="preview-generate"]').trigger('click')
    await flushPromises()

    i18n.global.locale.value = 'ar'
    await flushPromises()

    expect(runMock).toHaveBeenCalledTimes(1) // no refetch
    expect(wrapper.text()).toContain(reportsExtensions.ar.reports.insights.title)
    expect(wrapper.text()).toContain('IT Equipment')
    wrapper.unmount()
  })
})

/**
 * Shared reporting catalog — the list of data sources, fields, metrics,
 * filters and permissions this user is allowed to report on.
 *
 * The catalog is fetched once per session and shared by the question parser,
 * the report builder and the saved-report list, so switching tabs (or
 * language) never triggers another round trip. It carries no display text at
 * all: only ids, types and *label keys*, which the UI translates.
 */

import { computed, reactive, ref } from 'vue'
import { reportGeneratorService } from 'src/services/reports.service'

const catalog = ref(null)
const loading = ref(false)
const error = ref('')
const lookups = reactive({})
const pending = new Map()

export function useReportCatalog() {
  /** Fetch the catalog once; concurrent callers share the same promise. */
  async function loadCatalog(force = false) {
    if (catalog.value && !force) return catalog.value
    if (pending.has('__catalog') && !force) return pending.get('__catalog')

    loading.value = true
    error.value = ''
    const request = reportGeneratorService
      .catalog()
      .then((response) => {
        catalog.value = response?.data || null
        return catalog.value
      })
      .catch((err) => {
        error.value = err?.message || ''
        throw err
      })
      .finally(() => {
        loading.value = false
        pending.delete('__catalog')
      })

    pending.set('__catalog', request)
    return request
  }

  /** Distinct filter values (categories, suppliers, departments, …). */
  async function loadLookup(kind) {
    if (!kind) return []
    if (lookups[kind]) return lookups[kind]
    if (pending.has(kind)) return pending.get(kind)

    const request = reportGeneratorService
      .lookup(kind)
      .then((response) => {
        lookups[kind] = response?.data?.values || []
        return lookups[kind]
      })
      .catch(() => {
        lookups[kind] = []
        return []
      })
      .finally(() => pending.delete(kind))

    pending.set(kind, request)
    return request
  }

  /** Preload every lookup the catalog references — used by the NLU. */
  async function loadAllLookups() {
    const kinds = new Set()
    for (const mod of catalog.value?.modules || []) {
      for (const filter of mod.filters || []) if (filter.lookup) kinds.add(filter.lookup)
    }
    await Promise.all([...kinds].map((kind) => loadLookup(kind)))
    return lookups
  }

  const moduleById = (id) => (catalog.value?.modules || []).find((m) => m.id === id) || null

  return {
    catalog,
    loading,
    error,
    lookups,
    permissions: computed(() => catalog.value?.permissions || {}),
    modules: computed(() => catalog.value?.modules || []),
    loadCatalog,
    loadLookup,
    loadAllLookups,
    moduleById,
  }
}

export default useReportCatalog

import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { statisticsService } from 'src/services/statistics.service'

/**
 * ---------------------------------------------------------------------------
 * useStatistics — the data half of the summary-card system.
 * ---------------------------------------------------------------------------
 *
 * Design goals (task §10 "Statistics card performance"):
 *
 *   • ONE request per module + filter combination — never one per card.
 *   • Requests are DEBOUNCED, so typing in the search box does not fire a
 *     statistics call per keystroke.
 *   • A superseded request is CANCELLED (AbortController) instead of racing;
 *     the interceptor swallows the cancellation so no error toast appears.
 *   • Results are CACHED per `module + serialized filters` for a short TTL, so
 *     going back to a previously seen filter is instant and free.
 *   • `refresh()` bypasses the cache — that is what the Refresh button needs.
 *
 * @param {string|import('vue').Ref<string>} module
 * @param {() => object} filtersGetter  reactive source of the active filters
 */

const CACHE_TTL = 20_000
const cache = new Map()

const cacheKey = (module, params) => `${module}|${JSON.stringify(params)}`

/** Drop every cached entry for a module (used after a write). */
export function invalidateStatistics(module) {
  if (!module) return cache.clear()
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${module}|`)) cache.delete(key)
  }
}

/** Only meaningful, non-empty filters reach the API (and the cache key). */
function cleanParams(filters = {}) {
  const out = {}
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === null || value === undefined || value === '') continue
    if (['page', 'per_page', 'sort', 'direction'].includes(key)) continue
    out[key] = value
  }
  return out
}

export function useStatistics(module, filtersGetter = () => ({}), { debounce = 250, immediate = true } = {}) {
  const stats = shallowRef({})
  const loading = ref(false)
  const error = ref('')
  /** True when the numbers describe the filtered subset rather than everything. */
  const filtered = ref(false)

  let controller = null
  let timer = null
  let disposed = false

  const moduleName = () => (typeof module === 'string' ? module : module?.value)

  async function fetchNow({ force = false } = {}) {
    const name = moduleName()
    if (!name || disposed) return

    const params = cleanParams(typeof filtersGetter === 'function' ? filtersGetter() : filtersGetter)
    const key = cacheKey(name, params)

    if (!force) {
      const hit = cache.get(key)
      if (hit && Date.now() - hit.at < CACHE_TTL) {
        stats.value = hit.stats
        filtered.value = hit.filtered
        error.value = ''
        return
      }
    }

    // Cancel the in-flight request — its answer is already out of date.
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal

    loading.value = true
    try {
      const { data } = await statisticsService.get(name, params, { signal })
      if (signal.aborted || disposed) return
      stats.value = data?.stats || {}
      filtered.value = Boolean(data?.filtered)
      error.value = ''
      cache.set(key, { at: Date.now(), stats: stats.value, filtered: filtered.value })
    } catch (e) {
      if (e?.canceled || signal.aborted || disposed) return
      // Statistics are supplementary: a failure hides the cards, it never
      // blocks the table or raises a toast the user has to dismiss.
      error.value = e?.message || 'Unable to load statistics.'
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  function schedule(options) {
    clearTimeout(timer)
    timer = setTimeout(() => fetchNow(options), debounce)
  }

  /** Refresh button / after a write: skip the cache, ask the API again. */
  function refresh() {
    invalidateStatistics(moduleName())
    return fetchNow({ force: true })
  }

  watch(
    () => JSON.stringify(cleanParams(typeof filtersGetter === 'function' ? filtersGetter() : filtersGetter)),
    () => schedule(),
  )

  if (immediate) fetchNow()

  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(timer)
    controller?.abort()
  })

  return { stats, loading, error, filtered, refresh, reload: fetchNow }
}

export default useStatistics

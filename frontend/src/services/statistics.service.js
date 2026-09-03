import http from './api'

/**
 * Statistics & global search.
 *
 *   GET /statistics/:module   aggregated counters for a module's summary cards
 *   GET /search?q=            grouped global search
 *
 * `/statistics/:module` accepts the same query parameters as the module's list
 * endpoint, so the same filter object drives the table AND the cards.
 */
export const statisticsService = {
  /**
   * @param {string} module  e.g. 'assets', 'employees', 'assignments'
   * @param {object} params  the module's active filters (optional)
   * @param {object} options `{ signal }` — pass an AbortController signal so a
   *                         superseded refresh cancels instead of racing.
   */
  get: (module, params = {}, options = {}) =>
    http.get(`/statistics/${module}`, params, options),

  search: (q, params = {}, options = {}) =>
    http.get('/search', { q, ...params }, options),
}

export default statisticsService

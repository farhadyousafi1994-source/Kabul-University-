import http from './api'

/**
 * Advanced Report Generator — API surface.
 *
 * Every call sends a *structured* Report Query Object; the server validates it
 * against its own catalog allowlist and permissions before executing a single
 * read-only, parameterised statement. No SQL is ever produced on the client.
 */
export const reportGeneratorService = {
  /** Data sources, fields, metrics and filters this user may report on. */
  catalog: () => http.get('/reports/catalog'),

  /** Filter value suggestions (categories, suppliers, departments, …). */
  lookup: (kind) => http.get(`/reports/lookups/${kind}`),

  /** Dry run: normalise + validate a query for the preview card. */
  validate: (query) => http.post('/reports/query/validate', { query }),

  /** Execute a report. */
  run: (query) => http.post('/reports/query', { query }),

  saved: {
    list: () => http.get('/reports/saved'),
    create: (payload) => http.post('/reports/saved', payload),
    update: (id, payload) => http.put(`/reports/saved/${id}`, payload),
    remove: (id) => http.delete(`/reports/saved/${id}`),
    run: (id) => http.post(`/reports/saved/${id}/run`, {}),
  },

  schedules: {
    list: () => http.get('/reports/schedules'),
    create: (payload) => http.post('/reports/schedules', payload),
    update: (id, payload) => http.put(`/reports/schedules/${id}`, payload),
    remove: (id) => http.delete(`/reports/schedules/${id}`),
  },
}

export default reportGeneratorService

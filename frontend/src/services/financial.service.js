import http from './api'

/**
 * Module 18 — Depreciation, Module 19 — Disposal.
 */
export const depreciationService = {
  methods: () => http.get('/depreciation-methods'),
  list: (params = {}) => http.get('/depreciations', params),
  calculate: (payload = {}) => http.post('/depreciations/calculate', payload),
  runMonthly: () => http.post('/depreciations/run-monthly'),
  bookValue: (assetId) => http.get(`/assets/${assetId}/book-value`),
}

export const disposalService = {
  list: (params = {}) => http.get('/disposals', params),
  store: (payload) => http.post('/disposals', payload),
  inspect: (id, payload) => http.post(`/disposals/${id}/inspect`, payload),
  approve: (id, approve = true) => http.post(`/disposals/${id}/approve`, { approve }),
  execute: (id, payload = {}) => http.post(`/disposals/${id}/execute`, payload),
}

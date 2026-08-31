import http from './api'

/**
 * Module 14 — Audits.
 */
export const auditService = {
  list: (params = {}) => http.get('/audits', params),
  get: (id) => http.get(`/audits/${id}`),
  store: (payload) => http.post('/audits', payload),
  start: (id) => http.post(`/audits/${id}/start`),
  verify: (id, payload) => http.post(`/audits/${id}/verify`, payload),
  complete: (id) => http.post(`/audits/${id}/complete`),
  cancel: (id) => http.post(`/audits/${id}/cancel`),
}

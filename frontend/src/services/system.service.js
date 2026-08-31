import http from './api'

/**
 * Module 23/24 — Reports & exports, system settings.
 */
export const settingsService = {
  get: () => http.get('/settings'),
  update: (payload) => http.put('/settings', payload),
}

export const reportService = {
  list: () => http.get('/reports'),
  get: (name) => http.get(`/reports/${name}`),
  exportUrl: (name) => `/api/reports/${name}/export`,
}

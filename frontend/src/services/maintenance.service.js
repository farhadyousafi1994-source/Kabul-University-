import http from './api'

/**
 * Module 11/12 — Maintenance requests, work orders, incidents.
 */
export const maintenanceService = {
  requests: (params = {}) => http.get('/maintenance-requests', params),
  createRequest: (payload) => http.post('/maintenance-requests', payload),
  approveRequest: (id) => http.post(`/maintenance-requests/${id}/approve`),
  list: (params = {}) => http.get('/maintenances', params),
  get: (id) => http.get(`/maintenances/${id}`),
  create: (payload) => http.post('/maintenances', payload),
  transition: (id, payload) => http.patch(`/maintenances/${id}/status`, payload),
}

export const incidentService = {
  list: (params = {}) => http.get('/incidents', params),
  store: (payload) => http.post('/incidents', payload),
  updateStatus: (id, payload) => http.patch(`/incidents/${id}/status`, payload),
}

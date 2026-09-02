import http from './api'

/**
 * Employees module — dedicated HR directory (separate from user accounts).
 *
 * Contract (identical in the Laravel backend and the dev mock API):
 *
 *   GET    /employees              -> paginated list (+search/filters/sort)
 *   POST   /employees              -> create
 *   GET    /employees/:id          -> profile + asset_summary
 *   PUT    /employees/:id          -> update
 *   DELETE /employees/:id          -> archive (422 while assets are assigned)
 *   GET    /employees/:id/assets   -> assets currently assigned to employee
 */
export const employeeService = {
  list: (params) => http.get('/employees', params),
  get: (id) => http.get(`/employees/${id}`),
  create: (payload) => http.post('/employees', payload),
  update: (id, payload) => http.put(`/employees/${id}`, payload),
  remove: (id) => http.delete(`/employees/${id}`),
  assets: (id) => http.get(`/employees/${id}/assets`),
}

export default employeeService

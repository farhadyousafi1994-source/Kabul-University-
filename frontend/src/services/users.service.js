import http from './api'
import { makeCrudService } from './crud.factory'

/**
 * Module 3 — Users, roles & permissions.
 */
export const userService = makeCrudService('users')

export const userActions = {
  activate: (id) => http.post(`/users/${id}/activate`),
  deactivate: (id) => http.post(`/users/${id}/deactivate`),
  leave: (id) => http.post(`/users/${id}/leave`),
  /** Bulk-import employees from parsed CSV rows. */
  bulkImport: (rows) => http.post('/users/bulk', { rows }),
}

export const roleService = makeCrudService('roles')

export const roleActions = {
  permissions: () => http.get('/roles/permissions'),
}

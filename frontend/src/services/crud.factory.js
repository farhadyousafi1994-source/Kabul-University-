import http from './api'

/**
 * Factory for thin CRUD services matching the backend's apiResource
 * controllers: list (paginated, searchable, filterable), store, show,
 * update and destroy. Every module service delegates here.
 */
export function makeCrudService(base) {
  return {
    list: (params = {}) => http.get(`/${base}`, params),
    get: (id) => http.get(`/${base}/${id}`),
    create: (payload) => http.post(`/${base}`, payload),
    update: (id, payload) => http.put(`/${base}/${id}`, payload),
    remove: (id) => http.delete(`/${base}/${id}`),
  }
}

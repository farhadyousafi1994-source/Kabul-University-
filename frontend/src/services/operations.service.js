import http from './api'

/**
 * Module 8/9/10 — Assignments, transfers, asset requests.
 */
export const assignmentService = {
  list: (params = {}) => http.get('/asset-assignments', params),
  get: (id) => http.get(`/asset-assignments/${id}`),
  assign: (assetId, payload) => http.post(`/assets/${assetId}/assign`, payload),
  returnAsset: (id, payload) => http.post(`/asset-assignments/${id}/return`, payload),
}

export const transferService = {
  list: (params = {}) => http.get('/transfers', params),
  store: (assetId, payload) => http.post(`/assets/${assetId}/transfers`, payload),
  transition: (id, status) => http.patch(`/transfers/${id}/status`, { status }),
}

export const assetRequestService = {
  list: (params = {}) => http.get('/asset-requests', params),
  store: (payload) => http.post('/asset-requests', payload),
  submit: (id) => http.post(`/asset-requests/${id}/submit`),
  departmentApprove: (id, approve = true) => http.post(`/asset-requests/${id}/department-approve`, { approve }),
  managerApprove: (id, approve = true) => http.post(`/asset-requests/${id}/manager-approve`, { approve }),
  complete: (id) => http.post(`/asset-requests/${id}/complete`),
}

import http from './api'

/**
 * Module 6/7 — Assets, images & documents.
 */
export const assetService = {
  list: (params = {}) => http.get('/assets', params),
  get: (id) => http.get(`/assets/${id}`),
  create: (payload) => http.post('/assets', payload),
  update: (id, payload) => http.put(`/assets/${id}`, payload),
  remove: (id) => http.delete(`/assets/${id}`),
  changeStatus: (id, status) => http.patch(`/assets/${id}/status`, { status }),
  lookup: (code) => http.get('/assets/lookup', { code }),
  timeline: (id) => http.get(`/assets/${id}/timeline`),
  images: (id) => http.get(`/assets/${id}/images`),
  documents: (id) => http.get(`/assets/${id}/documents`),
  uploadImage: (id, payload) => http.post(`/assets/${id}/images`, payload),
  uploadDocument: (id, payload) => http.post(`/assets/${id}/documents`, payload),
  deleteImage: (id) => http.delete(`/asset-images/${id}`),
  deleteDocument: (id) => http.delete(`/asset-documents/${id}`),
  bookValue: (id) => http.get(`/assets/${id}/book-value`),
}

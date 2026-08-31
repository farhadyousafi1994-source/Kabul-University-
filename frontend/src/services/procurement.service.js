import http from './api'

/**
 * Module 16 — Procurement (purchase requests & orders).
 */
export const procurementService = {
  purchaseRequests: (params = {}) => http.get('/purchase-requests', params),
  createPurchaseRequest: (payload) => http.post('/purchase-requests', payload),
  approvePurchaseRequest: (id, payload = {}) => http.post(`/purchase-requests/${id}/approve`, payload),
  purchaseOrders: (params = {}) => http.get('/purchase-orders', params),
  createPurchaseOrder: (payload) => http.post('/purchase-orders', payload),
  purchaseOrder: (id) => http.get(`/purchase-orders/${id}`),
  sendOrder: (id) => http.post(`/purchase-orders/${id}/send`),
  receive: (id, payload = {}) => http.post(`/purchase-orders/${id}/receive`, payload),
}

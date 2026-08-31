import http from './api'
import { makeCrudService } from './crud.factory'

/**
 * Module 17 — Warehouses & stock transactions.
 */
export const warehouseService = makeCrudService('warehouses')

export const warehouseActions = {
  stock: (id) => http.get(`/warehouses/${id}/stock`),
  transactions: (params = {}) => http.get('/warehouse-transactions', params),
  record: (payload) => http.post('/warehouse-transactions', payload),
  transfer: (payload) => http.post('/warehouse-transactions/transfer', payload),
}

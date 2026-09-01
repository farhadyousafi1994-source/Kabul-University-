import http from './api'

/**
 * Module 20 — Notifications.
 */
export const notificationService = {
  list: (params = {}) => http.get('/notifications', params),
  markRead: (id) => http.post(`/notifications/${id}/read`),
  markAllRead: () => http.post('/notifications/read-all'),
  remove: (id) => http.delete(`/notifications/${id}`),
  clearRead: () => http.delete('/notifications'),
}

/**
 * Notification category map — drives the notification-center tabs, the
 * colored avatar tiles and the per-row type chip. `default` catches any
 * unknown type so new ones still render.
 */
export const NOTIFICATION_CATEGORIES = {
  assets: {
    types: ['asset_assigned', 'asset_returned', 'asset_registered', 'asset_disposed'],
    icon: 'inventory_2',
    badge: 'assignment_ind',
    color: '#2E7D32',
    tint: '#E8F5E9',
  },
  maintenance: {
    types: ['maintenance_completed', 'maintenance_scheduled', 'maintenance_assigned'],
    icon: 'build',
    badge: 'handyman',
    color: '#E07A1F',
    tint: '#FFF4E6',
  },
  approvals: {
    types: ['request_approval', 'purchase_approval', 'transfer_pending', 'transfer_approved'],
    icon: 'fact_check',
    badge: 'how_to_reg',
    color: '#EF6C00',
    tint: '#FFF3E0',
  },
  info: {
    types: ['warranty_expiring', 'system_info', 'system_update'],
    icon: 'info',
    badge: 'priority_high',
    color: '#0097A7',
    tint: '#E0F7FA',
  },
  security: {
    types: ['incident_reported', 'security_alert', 'anomaly_detected'],
    icon: 'health_and_safety',
    badge: 'emergency',
    color: '#E53935',
    tint: '#FFEBEE',
  },
  hr: {
    types: ['leave_request', 'leave_approved', 'leave_rejected', 'user_created'],
    icon: 'badge',
    badge: 'person',
    color: '#00897B',
    tint: '#E0F2F1',
  },
}

const DEFAULT_CATEGORY = {
  icon: 'notifications',
  badge: 'notifications',
  color: '#607D8B',
  tint: '#ECEFF1',
}

export function notificationCategory(type) {
  for (const [key, def] of Object.entries(NOTIFICATION_CATEGORIES)) {
    if (def.types.includes(type)) return { key, ...def }
  }
  return { key: 'other', ...DEFAULT_CATEGORY }
}

export default notificationService

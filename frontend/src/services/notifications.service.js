import http from './api'

/**
 * Module 20 — Notifications.
 */
export const notificationService = {
  list: () => http.get('/notifications'),
  markRead: (id) => http.post(`/notifications/${id}/read`),
  markAllRead: () => http.post('/notifications/read-all'),
}

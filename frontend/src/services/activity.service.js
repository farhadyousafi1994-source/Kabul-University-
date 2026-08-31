import http from './api'

/**
 * Module 21 — Activity logs.
 */
export const activityLogService = {
  list: (params = {}) => http.get('/activity-logs', params),
}

import http from './api'

/**
 * Module 24b — Appearance / theme preferences.
 *
 * Backend contract (Laravel `AppearanceController`, mirrored 1:1 by the dev
 * mock API in `frontend/mock-api/routes/appearance.routes.js`):
 *
 *   GET  /appearance          → { user, system, branding, can_manage_system }
 *   PUT  /appearance          → persist the signed-in user's preferences
 *   POST /appearance/reset    → clear them and fall back to the org default
 *   GET  /admin/appearance    → organization defaults + branding (admins)
 *   PUT  /admin/appearance    → update organization defaults + branding
 */
export const themeService = {
  get: () => http.get('/appearance'),
  update: (payload) => http.put('/appearance', payload),
  reset: () => http.post('/appearance/reset'),

  getSystem: () => http.get('/admin/appearance'),
  updateSystem: (payload) => http.put('/admin/appearance', payload),
}

export const appearanceService = themeService
export default themeService

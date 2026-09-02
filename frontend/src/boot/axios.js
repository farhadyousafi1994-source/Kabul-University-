import axios from 'axios'

/**
 * Central Axios instance for the whole application.
 * - Base URL comes from VITE_API_BASE (/api by default).
 * - Attaches the Sanctum Bearer token from the auth store.
 * - Unwraps the standard KU-AMS response envelope.
 * - Translates API errors into a consistent { message, errors } shape.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ku_ams_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const response = error.response || {}

    // Session expired or invalidated -> force re-login.
    if (response.status === 401) {
      localStorage.removeItem('ku_ams_token')
      localStorage.removeItem('ku_ams_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }

    return Promise.reject({
      status: response.status || 0,
      message:
        response.data?.message ||
        error.message ||
        'Something went wrong. Please try again.',
      errors: response.data?.errors || {},
      // Raw payload — needed by blob downloads to parse JSON error bodies.
      data: response.data,
    })
  },
)

export function registerAxios(app) {
  app.config.globalProperties.$api = api
}

export default api

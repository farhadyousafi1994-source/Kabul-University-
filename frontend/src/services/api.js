import api from 'src/boot/axios'

/**
 * Thin, typed helper over the shared axios instance.
 * Every module service delegates here so there is a single place where
 * requests, timeouts and envelope handling are configured.
 */
export const http = {
  get: (url, params) => api.get(url, { params }),
  post: (url, data) => api.post(url, data),
  put: (url, data) => api.put(url, data),
  patch: (url, data) => api.patch(url, data),
  delete: (url) => api.delete(url),

  /**
   * Upload helper — sends multipart/form-data.
   */
  upload: (url, formData) =>
    api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

export default http

import api from 'src/boot/axios'
import http from './api'

/**
 * Read a human error message out of a rejected blob download. The axios
 * interceptor rejects with `{ status, message, errors }`, but when
 * `responseType: 'blob'` was requested the JSON error body is still a Blob.
 */
async function extractBlobError(e) {
  const candidates = [e?.data, e?.response?.data].filter((v) => v instanceof Blob)
  for (const b of candidates) {
    try {
      const parsed = JSON.parse(await b.text())
      if (parsed?.message) return parsed.message
    } catch {
      /* not JSON — keep looking */
    }
  }
  if (e?.status === 404) return 'Backup file not found on the server.'
  return null
}

/**
 * Module 29 — Backup & disaster recovery.
 *
 * Contract (identical in the Laravel backend and the dev mock API):
 *
 *   GET    /backups               -> { data: [backup], meta: { count, total_size, last_backup } }
 *   POST   /backups               -> creates a server-side copy, returns { data: backup }
 *   GET    /backups/:id/download  -> the backup file itself (auth required)
 *   DELETE /backups/:id           -> removes the file and its record
 *   POST   /backups/restore       -> { data: <snapshot json> } restores the system
 *   GET    /backups/fresh-template-> "clean start" snapshot: users & lists kept, records empty
 *
 * Backups are real database copies (`.sqlite` on SQLite, `.json` on other
 * drivers). Restoring always takes an automatic safety copy first, so a bad
 * restore is recoverable.
 */
export const backupService = {
  list: () => http.get('/backups'),
  create: (payload = {}) => http.post('/backups', payload || {}),
  remove: (id) => http.delete(`/backups/${id}`),
  restore: (snapshot) => http.post('/backups/restore', { data: snapshot }),
  // Paths are relative to the axios baseURL (`/api` by default) — they must
  // NOT repeat the `/api` prefix or the request becomes `/api/api/…` (404).
  downloadUrl: (id) => `/backups/${id}/download`,
  freshTemplateUrl: '/backups/fresh-template',

  /**
   * Stream an authenticated file to the browser and save it under `filename`.
   * A plain <a href> would drop the Bearer token, so the bytes are fetched
   * with axios (responseType blob) and handed to the download manager.
   */
  async downloadFile(url, filename) {
    let blob
    try {
      blob = await api.get(url, { responseType: 'blob' })
    } catch (e) {
      // Error responses arrive as a Blob when responseType is blob, so the
      // axios interceptor cannot read `message` from them — parse it here.
      throw new Error(await extractBlobError(e) || e.message || 'Download failed.')
    }

    if (!(blob instanceof Blob)) {
      throw new Error('Download failed — the server did not return a file.')
    }

    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(href)
  },

  /**
   * Read an uploaded `.json` snapshot in the browser and validate its shape.
   * Returns the parsed snapshot; throws when the file is not a KU-AMS dump.
   */
  readSnapshot(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('no-file'))
        return
      }

      const reader = new FileReader()
      reader.onerror = () => reject(new Error('read-failed'))
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result))
          const tables = parsed?.tables
          if (!parsed || typeof parsed !== 'object' || !tables || typeof tables !== 'object') {
            reject(new Error('invalid'))
            return
          }
          resolve(parsed)
        } catch {
          reject(new Error('invalid'))
        }
      }
      reader.readAsText(file)
    })
  },
}

export default backupService

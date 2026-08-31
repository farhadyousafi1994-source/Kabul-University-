import { createMockServer } from './server.js'

/**
 * Vite plugin that serves the KU-AMS development mock API from /api.
 * Development only — set KU_AMS_USE_MOCK=false to proxy to the real
 * Laravel backend instead (see vite.config.js).
 */
export function kuAmsMockApi({ enabled = true } = {}) {
  let server = null

  return {
    name: 'ku-ams-mock-api',

    configureServer(viteServer) {
      if (!enabled) return
      server = createMockServer()

      viteServer.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) return next()
        server.emit('request', req, res)
      })
    },

    configurePreviewServer() {
      // The mock API is intentionally dev-only; preview builds expect the
      // real backend or a static export.
    },

    closeBundle() {
      server?.close()
    },
  }
}

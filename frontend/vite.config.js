import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { kuAmsMockApi } from './mock-api/index.js'

const useMockApi = process.env.KU_AMS_USE_MOCK !== 'false'

// ---------------------------------------------------------------------------
// KU-AMS Vite configuration
//
// The dev server can run in two modes:
//   1. MOCK MODE (default, KU_AMS_USE_MOCK=true):
//      A development-only REST API is served from /api by the mock-api
//      plugin (SQLite-backed, faithful mirror of the Laravel contract).
//      Perfect for running the full SPA without PHP.
//   2. LIVE MODE (KU_AMS_USE_MOCK=false):
//      Requests to /api are proxied to the real Laravel backend on :8000.
//
// Switching modes requires zero frontend code changes.
// ---------------------------------------------------------------------------
export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({
      // Must be an absolute path — the plugin injects it verbatim into every
      // Sass module, so relative paths cannot be resolved by the compiler.
      sassVariables: fileURLToPath(new URL('./src/css/quasar.variables.sass', import.meta.url)),
    }),
    kuAmsMockApi({ enabled: useMockApi }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'src': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 9000,
    // The live-preview environment uses a dynamic per-sandbox hostname.
    allowedHosts: true,
    proxy: {
      // Used only when the mock API is disabled.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})

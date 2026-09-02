import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({ sassVariables: fileURLToPath(new URL('./src/css/quasar.variables.sass', import.meta.url)) }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: false,
  test: {
    environment: 'jsdom',
    // Quasar dialogs and transitions need rAF/animation frames to settle.
    environmentOptions: { jsdom: { pretendToBeVisual: true } },
    globals: true,
    include: ['tests/**/*.spec.js'],
    testTimeout: 15000,
  },
})

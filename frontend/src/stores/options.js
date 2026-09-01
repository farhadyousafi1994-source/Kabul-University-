import { defineStore } from 'pinia'

/**
 * Personal workstation options — persisted immediately (unlike the theme
 * center, which previews first and saves on demand).
 *
 * `usdRate` is the AFN-per-USD exchange used when the display currency is
 * USD (the reference app shows "1 USD = 70 AFN").
 */
const STORAGE_KEY = 'ku_ams_options'

const DEFAULTS = {
  currency: 'AFN',
  usdRate: 70,
  rowsPerPage: 20,
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useOptionsStore = defineStore('options', {
  state: () => ({ ...readStored() }),

  actions: {
    patch(partial) {
      Object.assign(this.$state, partial)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
      } catch {
        /* storage unavailable */
      }
    },
  },
})

export default useOptionsStore

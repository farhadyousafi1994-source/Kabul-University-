import { defineStore } from 'pinia'
import { Dark } from 'quasar'

/**
 * Appearance / theme store — clone of the reference app's theme center.
 *
 * Everything the user can change (color scheme, display mode, font size,
 * corner radius, sidebar style, calendar, table density, animations, primary
 * color) is applied **live** to the document through CSS custom properties
 * and body classes, so the whole SPA re-skins instantly. Only "Save"
 * persists to localStorage; "Cancel" reverts to the last saved state.
 */

export const THEME_SCHEMES = [
  { id: 'steel',   name: 'Steel & Gold',     colors: ['#123A66', '#175A8C', '#C8862D', '#0B1626', '#F4F7FB'] },
  { id: 'minimal', name: 'Minimal',          colors: ['#1A1A1A', '#2E5BFF', '#2E5BFF', '#FFFFFF'] },
  { id: 'forest',  name: 'Forest Green',     colors: ['#1E4620', '#2E7D32', '#66A56B', '#E8F5E9'] },
  { id: 'royal',   name: 'Royal Purple',     colors: ['#4C1D95', '#7C3AED', '#A78BFA', '#F3EEFB'] },
  { id: 'amber',   name: 'Amber Sunset',     colors: ['#8A4A0E', '#E07A1F', '#F0A855', '#FFF4E6'] },
  { id: 'dark',    name: 'Dark Mode',        colors: ['#1A1B1E', '#2E7D64', '#8AE0C2', '#111214'] },
  { id: 'pastel',  name: 'Pastel',           colors: ['#2F6E4E', '#2F6E4E', '#E29A6E', '#FBEAE6'] },
  { id: 'vivid',   name: 'Vivid',            colors: ['#2A5BFF', '#2A5BFF', '#2A5BFF', '#E4EAFF'] },
  { id: 'neutral', name: 'Neutral',          colors: ['#5A4632', '#7A5C3A', '#A98C63', '#F2E9DE'] },
  { id: 'gradient',name: 'Gradient',         colors: ['#10B981', '#10B981', '#FCD34D', '#ECFDF5'] },
  { id: 'crimson', name: 'Crimson',          colors: ['#7F1D1D', '#B91C1C', '#F87171', '#FDEEEE'] },
  { id: 'teal',    name: 'Ocean Teal',       colors: ['#134E4A', '#0D9488', '#2DD4BF', '#E6FAF8'] },
]

// Quick-pick primary colors (the round dots next to the primary color control).
export const QUICK_COLORS = ['#175A8C', '#2E5BFF', '#2E7D32', '#7C3AED', '#E07A1F', '#B91C1C', '#0D9488']

const STORAGE_KEY = 'ku_ams_theme'
const DEFAULTS = {
  schemeId: 'steel',
  custom: null, // { headerFrom, headerTo, primary, accent, accentBg } — overrides the scheme
  mode: 'light',
  fontSize: 'M',
  radius: 'normal',
  sidebar: 'normal',
  calendar: 'gregorian',
  density: 'compact',
  animation: true,
}

const FONT_SIZES = { S: '14px', M: '15px', L: '16px', XL: '18px' }
const RADII = { sharp: '0px', normal: '10px', round: '16px' }

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return null
  }
}

function currentColors(settings) {
  const scheme = THEME_SCHEMES.find((s) => s.id === settings.schemeId) || THEME_SCHEMES[2]
  const [headerFrom, headerTo, primary, accent, accentBg] = scheme.colors
  return {
    headerFrom: settings.custom?.headerFrom || headerFrom,
    headerTo: settings.custom?.headerTo || headerTo,
    primary: settings.custom?.primary || primary,
    accent: settings.custom?.accent || accent,
    accentBg: settings.custom?.accentBg || accentBg,
  }
}

function applyToDom(settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const body = document.body
  const c = currentColors(settings)

  root.style.setProperty('--q-primary', c.primary)
  root.style.setProperty('--q-secondary', c.headerTo)
  root.style.setProperty('--q-accent', c.accent)
  root.style.setProperty('--ku-header-from', c.headerFrom)
  root.style.setProperty('--ku-header-to', c.headerTo)
  root.style.setProperty('--ku-accent-bg', c.accentBg)
  root.style.setProperty('--ku-radius', RADII[settings.radius] || RADII.normal)
  root.style.fontSize = FONT_SIZES[settings.fontSize] || FONT_SIZES.M

  body.classList.toggle('ku-density-loose', settings.density === 'loose')
  body.classList.toggle('ku-no-anim', !settings.animation)
  body.classList.toggle('ku-sidebar-mini', settings.sidebar === 'mini')

  Dark.set(settings.mode === 'dark')
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    settings: readStored() || { ...DEFAULTS },
    saved: readStored() || { ...DEFAULTS },
    schemes: THEME_SCHEMES,
    quickColors: QUICK_COLORS,
  }),

  getters: {
    isDirty: (state) => JSON.stringify(state.settings) !== JSON.stringify(state.saved),
    colors: (state) => currentColors(state.settings),
    activeScheme: (state) => state.schemes.find((s) => s.id === state.settings.schemeId) || state.schemes[2],
  },

  actions: {
    /** Apply any change to the DOM immediately (live preview). */
    patch(partial) {
      this.settings = { ...this.settings, ...partial }
      applyToDom(this.settings)
    },

    setScheme(id) {
      // Picking a fresh scheme clears manual customizations so the palette is intact.
      this.patch({ schemeId: id, custom: null })
    },

    setCustomColor(key, value) {
      const custom = { ...(this.settings.custom || {}), [key]: value }
      this.patch({ custom })
    },

    resetCustom() {
      this.patch({ custom: null })
    },

    /** Persist the current live state to localStorage. */
    save() {
      this.saved = { ...this.settings }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.saved))
      } catch {
        /* storage unavailable — live-only */
      }
      return this.saved
    },

    /** Revert the live preview to the last saved state. */
    cancel() {
      this.settings = { ...this.saved }
      applyToDom(this.settings)
    },

    /** Restore factory defaults (applied live; persisted on save). */
    reset() {
      this.settings = { ...DEFAULTS }
      applyToDom(this.settings)
    },

    /** Apply the stored theme once at app start. */
    applyInitial() {
      applyToDom(this.settings)
    },
  },
})

export default useThemeStore

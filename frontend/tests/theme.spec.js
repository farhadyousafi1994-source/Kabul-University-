/**
 * ---------------------------------------------------------------------------
 * Theme & Appearance store (task 3)
 * ---------------------------------------------------------------------------
 * Verifies that preferences are turned into CSS custom properties + body
 * classes (never hardcoded per component), that the live PREVIEW state is kept
 * apart from the PERSISTED state, and that persistence talks to the backend
 * with localStorage acting only as an instant-paint cache.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const getMock = vi.fn()
const updateMock = vi.fn()
const resetMock = vi.fn()
const getSystemMock = vi.fn()
const updateSystemMock = vi.fn()

vi.mock('src/services/theme.service', () => ({
  themeService: {
    get: (...a) => getMock(...a),
    update: (...a) => updateMock(...a),
    reset: (...a) => resetMock(...a),
    getSystem: (...a) => getSystemMock(...a),
    updateSystem: (...a) => updateSystemMock(...a),
  },
  appearanceService: {},
  default: {},
}))

vi.mock('src/utils/notify', () => {
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    apiError: vi.fn((err) => err),
  }
  return { notify, default: notify, tt: (k) => k }
})

import { useThemeStore, toApiPayload, fromApiPayload } from 'src/stores/theme'
import { COLOR_TOKENS, DEFAULT_THEME_SETTINGS, THEME_SCHEMES, findScheme } from 'src/config/themes'
import { notify } from 'src/utils/notify'

const cssVar = (name) => document.documentElement.style.getPropertyValue(name)
const hasBodyClass = (name) => document.body.classList.contains(name)

const API_DEFAULTS = {
  theme_mode: 'light',
  selected_theme: 'softcora',
  custom_colors: null,
  font_family: 'roboto',
  font_size: 'M',
  font_weight: 400,
  line_height: 1.5,
  border_radius: 'normal',
  sidebar_style: 'normal',
  table_density: 'compact',
  animations_enabled: true,
  calendar_type: 'gregorian',
  layout_preferences: { header: 'fixed', contentWidth: 'boxed', dashboardDensity: 'comfortable' },
  accessibility_preferences: { highContrast: false, reducedMotion: false, largerText: false, strongFocus: false, keyboardNav: true },
}

function freshStore() {
  localStorage.clear()
  setActivePinia(createPinia())
  document.documentElement.removeAttribute('style')
  document.body.className = ''
  return useThemeStore()
}

beforeEach(() => {
  vi.clearAllMocks()
  getMock.mockResolvedValue({ data: { user: null, system: API_DEFAULTS, branding: {}, can_manage_system: false } })
  updateMock.mockResolvedValue({ data: {} })
  resetMock.mockResolvedValue({ data: { user: null, system: API_DEFAULTS } })
})

afterEach(() => {
  localStorage.clear()
})

describe('theme registry', () => {
  it('ships the SoftCora house theme plus 12 other schemes', () => {
    expect(THEME_SCHEMES.length).toBeGreaterThanOrEqual(13)
    const softcora = findScheme('softcora')
    expect(softcora.name).toBe('SoftCora Default')
    expect(softcora.recommended).toBe(true)
  })

  it('every scheme provides the complete token set', () => {
    for (const scheme of THEME_SCHEMES) {
      for (const token of COLOR_TOKENS) {
        expect(scheme.colors[token], `${scheme.id}.${token}`).toBeTruthy()
      }
    }
  })
})

describe('applyTheme — CSS variables, not hardcoded colours', () => {
  it('writes Quasar, --app-* and legacy --ku-* tokens onto <html>', () => {
    const store = freshStore()
    store.applyTheme()

    expect(cssVar('--q-primary')).toBeTruthy()
    expect(cssVar('--app-primary')).toBe(cssVar('--q-primary'))
    expect(cssVar('--app-background')).toBeTruthy()
    expect(cssVar('--app-radius')).toBeTruthy()
    expect(cssVar('--app-font-size')).toBeTruthy()

    // Legacy aliases keep existing stylesheets working.
    expect(cssVar('--ku-header-from')).toBeTruthy()
    expect(cssVar('--ku-header-to')).toBeTruthy()
    expect(cssVar('--ku-accent-bg')).toBeTruthy()
    expect(cssVar('--ku-radius')).toBeTruthy()
  })

  it('switches the whole palette when a scheme is selected', () => {
    const store = freshStore()
    store.applyTheme()
    const before = cssVar('--app-primary')

    // A scheme that actually differs from the active one (some presets share a
    // primary on purpose, e.g. softcora/steel).
    const other = THEME_SCHEMES.find((s) => s.id !== store.settings.schemeId && s.colors.primary !== before)
    expect(other, 'at least one scheme must differ').toBeTruthy()

    store.selectPreset(other.id)

    expect(cssVar('--app-primary')).toBe(other.colors.primary)
    expect(cssVar('--app-primary')).not.toBe(before)
    expect(cssVar('--q-primary')).toBe(other.colors.primary)
    // The rest of the chrome follows the scheme too.
    expect(cssVar('--app-topbar-start')).toBe(other.colors.topBarStart)
  })

  it('applies radius, font size and dark mode', () => {
    const store = freshStore()

    store.setBorderRadius('sharp')
    expect(cssVar('--app-radius')).toBe('0px')
    store.setBorderRadius('round')
    expect(cssVar('--app-radius')).toBe('16px')

    store.setFontSize('XL')
    expect(cssVar('--app-font-size')).toBe('18px')

    store.setDisplayMode('dark')
    expect(store.isDark).toBe(true)
    expect(cssVar('--app-background')).toBe('#121418')

    store.setDisplayMode('light')
    expect(store.isDark).toBe(false)
  })

  it('mirrors density / animation / sidebar / accessibility onto body classes', () => {
    const store = freshStore()

    store.setTableDensity('spacious')
    expect(hasBodyClass('app-density-spacious')).toBe(true)
    expect(hasBodyClass('app-density-compact')).toBe(false)
    expect(hasBodyClass('ku-density-loose')).toBe(true) // legacy alias

    store.setAnimations(false)
    expect(hasBodyClass('ku-no-anim')).toBe(true)
    expect(hasBodyClass('app-no-anim')).toBe(true)
    expect(hasBodyClass('app-reduced-motion')).toBe(true)

    store.setSidebarStyle('mini')
    expect(hasBodyClass('ku-sidebar-mini')).toBe(true)
    store.setSidebarStyle('floating')
    expect(hasBodyClass('app-sidebar-floating')).toBe(true)
    expect(hasBodyClass('ku-sidebar-mini')).toBe(false)

    store.setAccessibility({ highContrast: true, largerText: true })
    expect(hasBodyClass('app-high-contrast')).toBe(true)
    expect(hasBodyClass('app-larger-text')).toBe(true)

    store.setLayout({ contentWidth: 'full' })
    expect(hasBodyClass('app-content-full')).toBe(true)
    expect(hasBodyClass('app-content-boxed')).toBe(false)
  })

  it('ignores invalid inputs instead of corrupting the theme', () => {
    const store = freshStore()
    const before = { ...store.settings }

    store.setDisplayMode('neon')
    store.setFontSize('XXL')
    store.setBorderRadius('blobby')
    store.setSidebarStyle('detached')
    store.setTableDensity('roomy')
    store.setCalendarType('lunar')
    store.updateCustomColor('primary', 'not-a-colour')
    store.updateCustomColor('notAToken', '#123456')

    expect(store.settings).toEqual(before)
  })
})

describe('custom colour overrides', () => {
  it('overrides a single token and keeps the rest of the scheme', () => {
    const store = freshStore()
    store.updateCustomColor('primary', '#FF0000')
    store.applyTheme()

    expect(store.settings.custom.primary).toBe('#ff0000')
    expect(cssVar('--app-primary')).toBe('#ff0000')
    expect(cssVar('--app-secondary')).toBe(findScheme(store.settings.schemeId).colors.secondary)
  })

  it('maps legacy v1 keys onto the current token names', () => {
    const store = freshStore()
    store.setCustomColor('headerFrom', '#010203')
    expect(store.settings.custom.topBarStart).toBe('#010203')
  })

  it('clearCustomColor() falls back to the preset value', () => {
    const store = freshStore()
    const preset = findScheme(store.settings.schemeId).colors.primary

    store.updateCustomColor('primary', '#123456')
    expect(store.colors.primary).toBe('#123456')

    store.clearCustomColor('primary')
    expect(store.colors.primary).toBe(preset)
    expect(store.settings.custom).toBeNull() // last override dropped → null
  })

  it('selectPreset() discards manual overrides', () => {
    const store = freshStore()
    store.updateCustomColor('primary', '#123456')
    store.selectPreset('softcora')
    expect(store.settings.custom).toBeNull()
    expect(store.colors.primary).toBe(findScheme('softcora').colors.primary)
  })

  it('keeps text readable on the chosen primary (WCAG contrast)', () => {
    const store = freshStore()
    store.updateCustomColor('primary', '#FFFFFF')
    expect(store.onPrimary).toBe('#111827')
    store.updateCustomColor('primary', '#000000')
    expect(store.onPrimary).toBe('#ffffff')
  })
})

describe('preview vs. persisted state', () => {
  it('isDirty tracks unsaved changes', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })
    expect(store.isDirty).toBe(false)

    store.selectPreset('dark')
    expect(store.isDirty).toBe(true)

    store.cancel()
    expect(store.isDirty).toBe(false)
    expect(store.settings.schemeId).toBe('softcora')
  })

  it('cancel() reverts the preview to the saved theme', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })
    const savedPrimary = store.colors.primary

    store.updateCustomColor('primary', '#00FF00')
    store.cancel()

    expect(store.colors.primary).toBe(savedPrimary)
    expect(cssVar('--app-primary')).toBe(savedPrimary)
  })
})

describe('backend persistence', () => {
  it('loadTheme() prefers the user row, then organisation defaults', async () => {
    const store = freshStore()
    getMock.mockResolvedValueOnce({
      data: {
        user: { ...API_DEFAULTS, selected_theme: 'forest', font_size: 'L', theme_mode: 'dark' },
        system: API_DEFAULTS,
        branding: { organizationName: 'Kabul University', brandName: 'SoftCora' },
        can_manage_system: true,
      },
    })

    await store.loadTheme({ silent: true })

    expect(store.settings.schemeId).toBe('forest')
    expect(store.settings.fontSize).toBe('L')
    expect(store.isDark).toBe(true)
    expect(store.canManageSystem).toBe(true)
    expect(store.systemBranding.organizationName).toBe('Kabul University')
    expect(store.isDirty).toBe(false)
  })

  it('loadTheme() falls back to the organisation default when the user has none', async () => {
    const store = freshStore()
    getMock.mockResolvedValueOnce({
      data: { user: null, system: { ...API_DEFAULTS, selected_theme: 'royal' }, branding: {}, can_manage_system: false },
    })

    await store.loadTheme({ silent: true })
    expect(store.settings.schemeId).toBe('royal')
  })

  it('caches to localStorage so the first paint is themed', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })
    expect(JSON.parse(localStorage.getItem('ku_ams_theme')).schemeId).toBe('softcora')
  })

  it('savePreferences() posts the API contract and clears the dirty flag', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })

    store.selectPreset('dark')
    store.setFontSize('L')
    expect(store.isDirty).toBe(true)

    const result = await store.savePreferences()

    expect(result.ok).toBe(true)
    expect(updateMock).toHaveBeenCalledTimes(1)
    const payload = updateMock.mock.calls[0][0]
    expect(payload.selected_theme).toBe('dark')
    expect(payload.font_size).toBe('L')
    expect(payload).toHaveProperty('theme_mode')
    expect(payload).toHaveProperty('custom_colors')
    expect(payload).toHaveProperty('layout_preferences')
    expect(payload).toHaveProperty('accessibility_preferences')

    expect(store.isDirty).toBe(false)
    expect(notify.success).toHaveBeenCalledWith('Theme preferences saved successfully.')
  })

  it('savePreferences() keeps the preview and reports the failure when the API rejects', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })
    store.selectPreset('dark')

    updateMock.mockRejectedValueOnce(new Error('Server unreachable'))
    const result = await store.savePreferences()

    expect(result.ok).toBe(false)
    expect(store.isDirty).toBe(true)             // preview preserved
    expect(store.settings.schemeId).toBe('dark') // nothing was rolled back
    expect(notify.error).toHaveBeenCalled()
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('savePreferences() cannot be double-submitted', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })
    let release
    updateMock.mockImplementationOnce(() => new Promise((r) => { release = r }))

    const first = store.savePreferences({ silent: true })
    const second = await store.savePreferences({ silent: true })

    expect(second).toEqual({ ok: false, skipped: true })
    release({ data: {} })
    await first
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('resetToDefault() clears the backend row and restores the system theme', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })
    store.selectPreset('crimson')
    store.updateCustomColor('primary', '#123456')

    const result = await store.resetToDefault()

    expect(result.ok).toBe(true)
    expect(resetMock).toHaveBeenCalledTimes(1)
    expect(store.settings.schemeId).toBe('softcora')
    expect(store.settings.custom).toBeNull()
    expect(store.isDirty).toBe(false)
    expect(notify.success).toHaveBeenCalledWith('Appearance settings restored to default.')
  })

  it('resetToDefault() survives an API failure', async () => {
    const store = freshStore()
    await store.loadTheme({ silent: true })
    store.selectPreset('crimson')
    resetMock.mockRejectedValueOnce(new Error('boom'))

    const result = await store.resetToDefault()
    expect(result.ok).toBe(false)
    expect(notify.error).toHaveBeenCalled()
  })

  it('admin defaults are read and written through the admin endpoints', async () => {
    const store = freshStore()
    getSystemMock.mockResolvedValueOnce({
      data: { defaults: { ...API_DEFAULTS, selected_theme: 'teal' }, branding: { brandName: 'SoftCora' }, can_manage_system: true },
    })

    await store.loadSystemDefaults()
    expect(store.system.schemeId).toBe('teal')
    expect(store.canManageSystem).toBe(true)

    updateSystemMock.mockResolvedValueOnce({
      data: { defaults: { ...API_DEFAULTS, selected_theme: 'amber' }, branding: { brandName: 'SoftCora' } },
    })
    await store.saveSystemDefaults({ defaults: { ...store.system, schemeId: 'amber' }, branding: { brandName: 'SoftCora' } })

    expect(updateSystemMock).toHaveBeenCalledTimes(1)
    expect(updateSystemMock.mock.calls[0][0].defaults.selected_theme).toBe('amber')
    expect(store.system.schemeId).toBe('amber')
  })
})

describe('API payload mapping', () => {
  it('round-trips store settings through the wire format', () => {
    const settings = {
      ...DEFAULT_THEME_SETTINGS,
      schemeId: 'forest',
      mode: 'dark',
      fontSize: 'L',
      sidebar: 'floating',
      tableDensity: 'spacious',
      calendar: 'solar',
      animation: false,
      custom: { primary: '#123456' },
    }

    const restored = fromApiPayload(toApiPayload(settings))

    expect(restored.schemeId).toBe('forest')
    expect(restored.mode).toBe('dark')
    expect(restored.fontSize).toBe('L')
    expect(restored.sidebar).toBe('floating')
    expect(restored.tableDensity).toBe('spacious')
    expect(restored.calendar).toBe('solar')
    expect(restored.animation).toBe(false)
    expect(restored.custom).toEqual({ primary: '#123456' })
  })

  it('sanitises unknown / hostile values coming back from the API', () => {
    const restored = fromApiPayload({
      selected_theme: 'does-not-exist',
      theme_mode: 'neon',
      font_size: 'XXL',
      border_radius: 'blobby',
      custom_colors: { primary: 'red', topBarStart: '#ABC' },
    })

    expect(restored.schemeId).toBe(DEFAULT_THEME_SETTINGS.schemeId)
    expect(restored.mode).toBe(DEFAULT_THEME_SETTINGS.mode)
    expect(restored.fontSize).toBe(DEFAULT_THEME_SETTINGS.fontSize)
    expect(restored.radius).toBe(DEFAULT_THEME_SETTINGS.radius)
    // `red` is rejected, the 3-digit hex is normalised to 6 digits.
    expect(restored.custom).toEqual({ topBarStart: '#aabbcc' })
  })
})

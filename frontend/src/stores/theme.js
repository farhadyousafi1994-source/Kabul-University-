import { defineStore } from 'pinia'
import { Dark } from 'quasar'
import {
  ACTION_COLORS,
  CARD_STYLES,
  COLOR_TOKENS,
  DARK_SURFACES,
  DENSITIES,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_TYPOGRAPHY,
  FONT_SIZES,
  LETTER_SPACINGS,
  NAV_STYLES,
  NUMERAL_SYSTEMS,
  RADII,
  RTL_FONT_STACK,
  THEME_SCHEMES,
  QUICK_COLORS,
  QUICK_COLOR_HEXES,
  contrastText,
  findScheme,
  fontStack,
  fontStackFor,
  isValidHex,
  normaliseHex,
  scriptForLocale,
} from 'src/config/themes'
import { ensureWebFonts } from 'src/utils/webfonts'
import { themeService } from 'src/services/theme.service'
import { notify } from 'src/utils/notify'
import i18n from 'src/i18n'

/**
 * Translate inside the store. Stores run outside component setup, so there is no
 * injected `t()` — the shared i18n instance is the canonical accessor and keeps
 * toasts in sync with the active locale.
 */
const t = (key, params) => i18n.global.t(key, params || {})

/**
 * ---------------------------------------------------------------------------
 * Appearance / Theme store — the application-wide design-token controller.
 * ---------------------------------------------------------------------------
 *
 * Every visual preference (colour scheme, display mode, typography, corner
 * radius, sidebar style, table density, calendar, animations, layout and
 * accessibility) is applied **live** to the document as CSS custom properties
 * and body classes, so the whole SPA re-skins instantly without a reload.
 *
 * Two states are kept apart:
 *   `settings` — the live PREVIEW state (what the user is looking at now)
 *   `saved`    — the last PERSISTED state (backend → localStorage fallback)
 * "Cancel" reverts preview → saved; "Save" writes preview → backend → saved.
 *
 * Persistence priority:
 *   1. user preferences  (GET /appearance)
 *   2. organization defaults (GET /admin/appearance, admin-only to write)
 *   3. application defaults (DEFAULT_THEME_SETTINGS)
 * localStorage is only an instant-paint cache so the first frame is themed
 * before the API answers.
 */

const STORAGE_KEY = 'ku_ams_theme'
const SYSTEM_KEY = 'ku_ams_theme_system'

/** Keys that were stored by the previous (v1) theme centre. */
const LEGACY_CUSTOM_KEYS = { headerFrom: 'topBarStart', headerTo: 'topBarEnd', accentBg: 'accentBackground' }

const clone = (value) => JSON.parse(JSON.stringify(value ?? null))

function migrateCustom(custom) {
  if (!custom || typeof custom !== 'object') return null
  const next = {}
  for (const [key, value] of Object.entries(custom)) {
    const mapped = LEGACY_CUSTOM_KEYS[key] || key
    if (COLOR_TOKENS.includes(mapped) && isValidHex(value)) next[mapped] = normaliseHex(value)
  }
  return Object.keys(next).length ? next : null
}

/** Merge + validate the typography block (Language & Typography settings). */
function sanitiseTypography(raw) {
  const out = { ...DEFAULT_TYPOGRAPHY }
  if (!raw || typeof raw !== 'object') return out
  if (typeof raw.persianFont === 'string') out.persianFont = raw.persianFont
  if (typeof raw.arabicFont === 'string') out.arabicFont = raw.arabicFont
  if (LETTER_SPACINGS[raw.letterSpacing]) out.letterSpacing = raw.letterSpacing
  if (NUMERAL_SYSTEMS.includes(raw.numerals)) out.numerals = raw.numerals
  if (typeof raw.headingWeight === 'number' && raw.headingWeight >= 500 && raw.headingWeight <= 900) {
    out.headingWeight = raw.headingWeight
  }
  return out
}

/** Merge + validate the layout block (interface preferences). */
function sanitiseLayout(raw, base) {
  const out = { ...base }
  if (!raw || typeof raw !== 'object') {
    out.typography = sanitiseTypography(base.typography)
    return out
  }
  if (['fixed', 'sticky', 'normal', 'static'].includes(raw.header)) out.header = raw.header
  if (['boxed', 'full'].includes(raw.contentWidth)) out.contentWidth = raw.contentWidth
  if (DENSITIES.includes(raw.dashboardDensity)) out.dashboardDensity = raw.dashboardDensity
  if (CARD_STYLES.includes(raw.cardStyle)) out.cardStyle = raw.cardStyle
  if (NAV_STYLES.includes(raw.navigation)) out.navigation = raw.navigation
  out.typography = sanitiseTypography(raw.typography ?? base.typography)
  return out
}

function sanitise(raw) {
  const base = clone(DEFAULT_THEME_SETTINGS)
  if (!raw || typeof raw !== 'object') return base
  const out = { ...base }

  if (raw.schemeId && THEME_SCHEMES.some((s) => s.id === raw.schemeId)) out.schemeId = raw.schemeId
  if (['light', 'dark', 'system'].includes(raw.mode)) out.mode = raw.mode
  out.custom = migrateCustom(raw.custom)

  if (raw.fontFamily) out.fontFamily = raw.fontFamily
  if (FONT_SIZES[raw.fontSize]) out.fontSize = raw.fontSize
  if (typeof raw.fontWeight === 'number') out.fontWeight = raw.fontWeight
  if (typeof raw.lineHeight === 'number') out.lineHeight = raw.lineHeight

  if (RADII[raw.radius]) out.radius = raw.radius
  if (['mini', 'normal', 'expanded', 'floating'].includes(raw.sidebar)) out.sidebar = raw.sidebar

  // `density` was the v1 name of `tableDensity` (values compact/loose).
  const density = raw.tableDensity || raw.density
  if (DENSITIES.includes(density)) {
    out.tableDensity = density
  } else if (density === 'loose') {
    out.tableDensity = 'comfortable'
  }
  out.density = out.tableDensity

  if (['gregorian', 'solar'].includes(raw.calendar)) out.calendar = raw.calendar
  if (typeof raw.animation === 'boolean') out.animation = raw.animation
  if (typeof raw.animationsEnabled === 'boolean') out.animation = raw.animationsEnabled

  out.layout = sanitiseLayout(raw.layout ?? raw.layoutPreferences, base.layout)
  if (raw.accessibility && typeof raw.accessibility === 'object') out.accessibility = { ...base.accessibility, ...raw.accessibility }
  if (raw.accessibilityPreferences && typeof raw.accessibilityPreferences === 'object') {
    out.accessibility = { ...base.accessibility, ...raw.accessibilityPreferences }
  }

  return out
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? sanitise(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — live-only */
  }
}

/** Effective (preview) colours = preset tokens + user overrides. */
export function resolveColors(settings) {
  const scheme = findScheme(settings.schemeId)
  const custom = settings.custom || {}
  const colors = { ...scheme.colors }
  for (const key of COLOR_TOKENS) {
    if (custom[key]) colors[key] = colors[key] && String(colors[key]).startsWith('rgba') ? colors[key] : custom[key]
  }
  return colors
}

function prefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

let mediaQuery = null
let mediaHandler = null
let localeHandler = null

export const useThemeStore = defineStore('theme', {
  state: () => ({
    /** live preview */
    settings: readCache(STORAGE_KEY) || clone(DEFAULT_THEME_SETTINGS),
    /** last persisted state */
    saved: readCache(STORAGE_KEY) || clone(DEFAULT_THEME_SETTINGS),
    /** administrator / organization defaults */
    system: readCache(SYSTEM_KEY) || clone(DEFAULT_THEME_SETTINGS),
    systemBranding: { organizationName: '', brandName: '', logoUrl: '', faviconUrl: '' },
    schemes: THEME_SCHEMES,
    quickColors: QUICK_COLORS,
    colorTokens: COLOR_TOKENS,
    loading: false,
    saving: false,
    loaded: false,
    canManageSystem: false,
  }),

  getters: {
    isDirty: (state) => JSON.stringify(state.settings) !== JSON.stringify(state.saved),
    colors: (state) => resolveColors(state.settings),
    savedColors: (state) => resolveColors(state.saved),
    activeScheme: (state) => findScheme(state.settings.schemeId),
    /** 'light' | 'dark' after resolving `mode: 'system'` */
    resolvedMode: (state) => (state.settings.mode === 'system' ? (prefersDark() ? 'dark' : 'light') : state.settings.mode),
    isDark() {
      return this.resolvedMode === 'dark'
    },
    fontStackValue: (state) => fontStack(state.settings.fontFamily),
    /** Typography block (Language & Typography settings), always complete. */
    typography: (state) => ({ ...DEFAULT_TYPOGRAPHY, ...(state.settings.layout?.typography || {}) }),
    /** Script implied by the active <html lang> — 'latin' | 'persian' | 'arabic'. */
    activeScript: () => scriptForLocale(
      (typeof document !== 'undefined' && document.documentElement.getAttribute('lang')) || 'en',
    ),
    /** Font stack currently used for Farsi / Dari text. */
    persianFontStack() {
      return fontStackFor('persian', this.typography.persianFont)
    },
    /** Font stack currently used for Arabic text. */
    arabicFontStack() {
      return fontStackFor('arabic', this.typography.arabicFont)
    },
    /** The stack that the ACTIVE language renders with. */
    activeFontStack() {
      const script = this.activeScript
      if (script === 'persian') return this.persianFontStack
      if (script === 'arabic') return this.arabicFontStack
      return this.fontStackValue
    },
    cardStyle: (state) => state.settings.layout?.cardStyle || 'elevated',
    navigationStyle: (state) => state.settings.layout?.navigation || 'solid',
    radiusValue: (state) => RADII[state.settings.radius] || RADII.normal,
    fontSizeValue: (state) => FONT_SIZES[state.settings.fontSize] || FONT_SIZES.M,
    /** Text colour that stays readable on the primary colour. */
    onPrimary() {
      return contrastText(this.colors.primary)
    },
  },

  actions: {
    // -- DOM application -----------------------------------------------------

    /** Apply the live preview state to the document. Cheap and idempotent. */
    applyTheme() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      const body = document.body
      const s = this.settings
      const c = this.colors
      const custom = s.custom || {}
      const dark = this.resolvedMode === 'dark'
      const layout = s.layout || {}
      const typo = layout.typography || DEFAULT_TYPOGRAPHY
      const actions = dark ? ACTION_COLORS.dark : ACTION_COLORS.light

      // Quasar brand variables — every Quasar component reads these.
      root.style.setProperty('--q-primary', c.primary)
      root.style.setProperty('--q-secondary', c.secondary)
      root.style.setProperty('--q-accent', c.accent)
      root.style.setProperty('--q-positive', c.positive)
      root.style.setProperty('--q-negative', c.negative)
      root.style.setProperty('--q-info', c.info)
      root.style.setProperty('--q-warning', c.warning)

      // Navigation bar: solid brand-neutral, brand primary, or light surface.
      const navStyle = NAV_STYLES.includes(layout.navigation) ? layout.navigation : 'solid'
      const topbar = navStyle === 'primary' ? c.primary : navStyle === 'light' ? (dark ? DARK_SURFACES.surface : c.surface) : c.topBarStart
      const topbarText = contrastText(navStyle === 'light' && !dark ? '#ffffff' : topbar)

      // Script-aware typography: the family follows the ACTIVE language.
      const locale = (typeof document !== 'undefined' && root.getAttribute('lang')) || 'en'
      const script = scriptForLocale(locale)
      const rtlFontId = script === 'arabic' ? typo.arabicFont : typo.persianFont
      const rtlStack = script === 'latin'
        ? `${fontStack(s.fontFamily)}, ${RTL_FONT_STACK}`
        : fontStackFor(script, rtlFontId)

      // Pull in the web fonts the user actually selected (once each).
      ensureWebFonts([s.fontFamily, typo.persianFont, typo.arabicFont])

      // Canonical app tokens (src/css/theme.css maps the rest onto these).
      const tokens = {
        '--app-primary': c.primary,
        '--app-primary-soft': `color-mix(in srgb, ${c.primary} 12%, transparent)`,
        '--app-secondary': c.secondary,
        '--app-accent': c.accent,
        '--app-accent-background': c.accentBackground,
        '--app-topbar-start': c.topBarStart,
        '--app-topbar-end': c.topBarEnd,
        '--app-topbar': topbar,
        '--app-topbar-text': topbarText,
        '--app-topbar-muted': topbarText === '#ffffff' ? 'rgba(255,255,255,.68)' : 'rgba(16,24,40,.62)',
        '--app-topbar-border': topbarText === '#ffffff' ? 'rgba(255,255,255,.08)' : 'var(--app-border)',
        '--app-sidebar-background': dark ? '#171A1F' : c.sidebarBackground,
        '--app-sidebar-active': c.sidebarActive,
        '--app-background': dark ? DARK_SURFACES.background : c.background,
        '--app-surface': dark ? DARK_SURFACES.surface : c.surface,
        '--app-card': dark ? DARK_SURFACES.card : c.card,
        // A user-chosen font colour wins over the mode default — that is the
        // whole point of the setting — so only fall back to the dark ink when
        // the token was not overridden.
        '--app-text-primary': custom.text || (dark ? DARK_SURFACES.text : c.text),
        '--app-text-secondary': custom.textSecondary || (dark ? DARK_SURFACES.textSecondary : c.textSecondary),
        '--app-link': custom.link || c.link || c.primary,
        '--app-border': dark ? DARK_SURFACES.border : c.border,
        '--app-border-strong': dark ? 'rgba(255,255,255,.16)' : `color-mix(in srgb, ${c.text} 16%, ${c.border})`,
        '--app-hover': dark ? DARK_SURFACES.hover : c.hover,
        '--app-focus': c.focus,
        '--app-positive': c.positive,
        '--app-negative': c.negative,
        '--app-warning': c.warning,
        '--app-info': c.info,
        '--app-on-primary': contrastText(c.primary),
        '--app-radius': RADII[s.radius] || RADII.normal,
        '--app-font-size': FONT_SIZES[s.fontSize] || FONT_SIZES.M,
        '--app-font-family': fontStack(s.fontFamily),
        '--app-font-family-rtl': rtlStack,
        '--app-font-weight': String(s.fontWeight || 400),
        '--app-heading-weight': String(typo.headingWeight || 700),
        '--app-line-height': String(s.lineHeight || 1.55),
        '--app-letter-spacing': LETTER_SPACINGS[typo.letterSpacing] || LETTER_SPACINGS.normal,
      }

      // Action colours (Excel green, Edit blue, Delete red …). `null` means
      // "follow the brand primary", which keeps Save/Create on-theme.
      for (const [intent, value] of Object.entries(actions)) {
        tokens[`--app-action-${intent}`] = value || c.primary
      }

      for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value)

      // Legacy `--ku-*` aliases kept alive for existing stylesheets.
      root.style.setProperty('--ku-header-from', c.topBarStart)
      root.style.setProperty('--ku-header-to', c.topBarEnd)
      root.style.setProperty('--ku-accent-bg', c.accentBackground)
      root.style.setProperty('--ku-radius', RADII[s.radius] || RADII.normal)
      root.style.setProperty('--ku-page-bg', tokens['--app-background'])
      root.style.setProperty('--ku-card-bg', tokens['--app-card'])
      root.style.setProperty('--ku-ink', tokens['--app-text-primary'])
      root.style.setProperty('--ku-ink-soft', tokens['--app-text-secondary'])
      root.style.setProperty('--ku-link', tokens['--app-link'])
      root.style.setProperty('--ku-card-border', tokens['--app-border'])
      root.style.setProperty('--ku-line', tokens['--app-border'])
      root.style.setProperty('--ku-navy-2', c.secondary)
      root.style.setProperty('--ku-brand', c.primary)
      root.style.setProperty('--ku-brand-soft', tokens['--app-primary-soft'])
      root.style.fontSize = tokens['--app-font-size']

      // Body classes — density, animation, sidebar, accessibility, layout.
      const a11y = s.accessibility || {}
      const density = s.tableDensity || 'compact'
      const cardStyle = CARD_STYLES.includes(layout.cardStyle) ? layout.cardStyle : 'elevated'
      const numerals = NUMERAL_SYSTEMS.includes(typo.numerals) ? typo.numerals : 'auto'
      const classes = {
        'ku-density-loose': density !== 'compact',
        'app-density-compact': density === 'compact',
        'app-density-comfortable': density === 'comfortable',
        'app-density-spacious': density === 'spacious',
        'ku-no-anim': !s.animation,
        'app-no-anim': !s.animation,
        'ku-sidebar-mini': s.sidebar === 'mini',
        'app-sidebar-mini': s.sidebar === 'mini',
        'app-sidebar-expanded': s.sidebar === 'expanded',
        'app-sidebar-floating': s.sidebar === 'floating',
        'app-high-contrast': Boolean(a11y.highContrast),
        'app-reduced-motion': Boolean(a11y.reducedMotion) || !s.animation,
        'app-larger-text': Boolean(a11y.largerText),
        'app-strong-focus': Boolean(a11y.strongFocus),
        'app-keyboard-nav': a11y.keyboardNav !== false,
        'app-content-boxed': layout.contentWidth !== 'full',
        'app-content-full': layout.contentWidth === 'full',
        'app-header-sticky': layout.header === 'sticky',
        'app-header-normal': layout.header === 'normal',
        'app-dash-compact': layout.dashboardDensity === 'compact',
        'app-dash-spacious': layout.dashboardDensity === 'spacious',
        'app-cards-elevated': cardStyle === 'elevated',
        'app-cards-flat': cardStyle === 'flat',
        'app-cards-outlined': cardStyle === 'outlined',
        'app-nav-solid': navStyle === 'solid',
        'app-nav-primary': navStyle === 'primary',
        'app-nav-light': navStyle === 'light',
        'app-numerals-persian': numerals === 'persian' || (numerals === 'auto' && script !== 'latin'),
      }
      for (const [name, on] of Object.entries(classes)) body.classList.toggle(name, on)

      // Quasar's own dark mode (adds `body--dark` and swaps the dark palette).
      Dark.set(dark)
    },

    /** Backwards-compatible alias used across the app. */
    patch(partial) {
      this.settings = { ...this.settings, ...clone(partial) }
      this.applyTheme()
    },

    /** Preview-only update used by the Theme & Appearance page. */
    previewTheme(partial) {
      this.patch(partial)
    },

    applyInitial() {
      this.applyTheme()
      this.watchSystemPreference()
      this.watchLocale()
    },

    /**
     * Re-apply the theme whenever the interface language changes, so the
     * Farsi/Dari/Arabic font, the numeral system and the RTL metrics switch
     * together with the translation (see `applyLocale()` in src/i18n).
     */
    watchLocale() {
      if (typeof window === 'undefined' || localeHandler) return
      localeHandler = () => this.applyTheme()
      window.addEventListener('app:locale-changed', localeHandler)
    },

    // -- system colour-scheme listener --------------------------------------
    watchSystemPreference() {
      if (typeof window === 'undefined' || !window.matchMedia) return
      if (mediaQuery) return
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaHandler = () => {
        if (this.settings.mode === 'system') this.applyTheme()
      }
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', mediaHandler)
      else mediaQuery.addListener?.(mediaHandler)
    },

    stopWatchingSystemPreference() {
      if (!mediaQuery || !mediaHandler) return
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', mediaHandler)
      else mediaQuery.removeListener?.(mediaHandler)
      mediaQuery = null
      mediaHandler = null
    },

    // -- individual setters (each one previews instantly) --------------------
    selectPreset(id) {
      // Choosing a preset restores its full palette (drops manual overrides).
      this.patch({ schemeId: id, custom: null })
    },

    /** Legacy alias. */
    setScheme(id) {
      this.selectPreset(id)
    },

    updateCustomColor(key, value) {
      if (!COLOR_TOKENS.includes(key) || !isValidHex(value)) return
      const custom = { ...(this.settings.custom || {}), [key]: normaliseHex(value) }
      this.patch({ custom })
    },

    /** Legacy alias. */
    setCustomColor(key, value) {
      this.updateCustomColor(LEGACY_CUSTOM_KEYS[key] || key, value)
    },

    updatePrimaryColor(value) {
      if (!isValidHex(value)) return
      const primary = normaliseHex(value)
      const scheme = findScheme(this.settings.schemeId)
      this.patch({
        custom: {
          ...(this.settings.custom || {}),
          primary,
          // Keep the chrome coherent with the new primary.
          topBarStart: scheme.colors.topBarStart,
          sidebarActive: primary,
          focus: primary,
        },
      })
    },

    /** Drop a single override so the token falls back to the preset value. */
    clearCustomColor(key) {
      const custom = { ...(this.settings.custom || {}) }
      delete custom[key]
      this.patch({ custom: Object.keys(custom).length ? custom : null })
    },

    restorePresetColors() {
      this.patch({ custom: null })
    },

    /** Legacy alias. */
    resetCustom() {
      this.restorePresetColors()
    },

    setDisplayMode(mode) {
      if (!['light', 'dark', 'system'].includes(mode)) return
      this.patch({ mode })
    },

    setFontSize(size) {
      if (FONT_SIZES[size]) this.patch({ fontSize: size })
    },

    setFontFamily(id) {
      this.patch({ fontFamily: id })
    },

    /** Global font (text) colour — headings, body, labels, tables, cards. */
    setFontColor(value) {
      this.updateCustomColor('text', value)
    },

    /** Global link colour — nav links, table links, inline/interactive text. */
    setLinkColor(value) {
      this.updateCustomColor('link', value)
    },

    /** Drop the font/link overrides so they follow the active preset again. */
    clearFontColor() {
      this.clearCustomColor('text')
    },

    clearLinkColor() {
      this.clearCustomColor('link')
    },

    setBorderRadius(radius) {
      if (RADII[radius]) this.patch({ radius })
    },

    setSidebarStyle(style) {
      if (['mini', 'normal', 'expanded', 'floating'].includes(style)) this.patch({ sidebar: style })
    },

    setTableDensity(density) {
      if (!DENSITIES.includes(density)) return
      this.patch({ tableDensity: density, density })
    },

    setAnimations(enabled) {
      this.patch({ animation: Boolean(enabled) })
    },

    setCalendarType(type) {
      if (['gregorian', 'solar'].includes(type)) this.patch({ calendar: type })
    },

    /** Language & Typography — Farsi/Dari font. */
    setPersianFont(id) {
      this.setTypography({ persianFont: id })
    },

    /** Language & Typography — Arabic font. */
    setArabicFont(id) {
      this.setTypography({ arabicFont: id })
    },

    setLetterSpacing(value) {
      if (LETTER_SPACINGS[value]) this.setTypography({ letterSpacing: value })
    },

    /** Digit rendering: auto / latin / persian / arabic. */
    setNumerals(value) {
      if (NUMERAL_SYSTEMS.includes(value)) this.setTypography({ numerals: value })
    },

    setHeadingWeight(value) {
      const weight = Number(value)
      if (weight >= 500 && weight <= 900) this.setTypography({ headingWeight: weight })
    },

    /** Merge a partial typography block (nested inside `layout`). */
    setTypography(partial) {
      const layout = this.settings.layout || {}
      this.setLayout({ typography: { ...DEFAULT_TYPOGRAPHY, ...(layout.typography || {}), ...partial } })
    },

    /** Card surface treatment: elevated / flat / outlined. */
    setCardStyle(style) {
      if (CARD_STYLES.includes(style)) this.setLayout({ cardStyle: style })
    },

    /** Navigation appearance: solid / primary / light. */
    setNavigationStyle(style) {
      if (NAV_STYLES.includes(style)) this.setLayout({ navigation: style })
    },

    setLayout(partial) {
      this.patch({ layout: { ...(this.settings.layout || {}), ...partial } })
    },

    setAccessibility(partial) {
      this.patch({ accessibility: { ...(this.settings.accessibility || {}), ...partial } })
    },

    // -- persistence ---------------------------------------------------------

    /** Load user preferences (falling back to organization → app defaults). */
    async loadTheme({ silent = false } = {}) {
      this.loading = true
      try {
        const { data } = await themeService.get()
        const userPrefs = data?.user || data?.preferences || null
        const systemPrefs = data?.system || data?.defaults || null
        const branding = data?.branding || null

        // NOTE: the wire format is snake_case (`selected_theme`, `font_size`, …)
        // while the store speaks camelCase (`schemeId`, `fontSize`, …).
        // `fromApiPayload()` is the ONLY correct bridge — passing the raw
        // response to `sanitise()` silently discarded every saved preference.
        if (systemPrefs) {
          this.system = fromApiPayload(systemPrefs)
          writeCache(SYSTEM_KEY, this.system)
        }
        if (branding) this.systemBranding = { ...this.systemBranding, ...branding }
        this.canManageSystem = Boolean(data?.can_manage_system)

        // Priority: user → organization → application default.
        const effective = userPrefs ? fromApiPayload(userPrefs) : clone(this.system)
        this.saved = effective
        this.settings = clone(effective)
        writeCache(STORAGE_KEY, this.saved)
        this.loaded = true
        this.applyTheme()
        return this.saved
      } catch (err) {
        // Offline / unauthenticated: keep the cached theme, tell the user once.
        this.loaded = true
        this.applyTheme()
        if (!silent) notify.error(err?.message || 'Unable to load appearance settings.')
        return this.saved
      } finally {
        this.loading = false
      }
    },

    /** Persist the live preview to the backend (localStorage mirrors it). */
    async savePreferences({ silent = false } = {}) {
      if (this.saving) return { ok: false, skipped: true }
      this.saving = true
      const payload = toApiPayload(this.settings)
      try {
        await themeService.update(payload)
        this.saved = clone(this.settings)
        writeCache(STORAGE_KEY, this.saved)
        this.applyTheme()
        if (!silent) notify.success(t('theme.saved'))
        return { ok: true }
      } catch (err) {
        // Keep the preview, mirror it locally so a refresh does not lose it.
        writeCache(STORAGE_KEY, this.settings)
        if (!silent) notify.error(err?.message || t('theme.saveFailed'))
        return { ok: false, error: err }
      } finally {
        this.saving = false
      }
    },

    /** Discard unsaved changes and restore the last saved theme. */
    cancel() {
      this.settings = clone(this.saved)
      this.applyTheme()
    },

    /** Ask the backend to clear the stored preferences and return the default. */
    async resetToDefault({ persist = true, silent = false } = {}) {
      const fallback = clone(this.system)
      this.settings = clone(fallback)
      this.applyTheme()
      if (!persist) return { ok: true }

      try {
        const { data } = await themeService.reset()
        const next = fromApiPayload(data?.user || data?.preferences || data?.system || fallback)
        this.settings = clone(next)
        this.saved = clone(next)
        writeCache(STORAGE_KEY, this.saved)
        this.applyTheme()
        if (!silent) notify.success(t('theme.restored'))
        return { ok: true }
      } catch (err) {
        this.saved = clone(fallback)
        writeCache(STORAGE_KEY, this.saved)
        if (!silent) notify.error(err?.message || t('theme.resetFailed'))
        return { ok: false, error: err }
      }
    },

    /** Legacy alias — factory reset applied live, persisted on save. */
    reset() {
      this.settings = clone(this.system)
      this.applyTheme()
    },

    // -- administrator defaults ---------------------------------------------
    async loadSystemDefaults() {
      try {
        const { data } = await themeService.getSystem()
        if (data?.defaults) {
          this.system = fromApiPayload(data.defaults)
          writeCache(SYSTEM_KEY, this.system)
        }
        if (data?.branding) this.systemBranding = { ...this.systemBranding, ...data.branding }
        this.canManageSystem = Boolean(data?.can_manage_system)
        return this.system
      } catch {
        return this.system
      }
    },

    async saveSystemDefaults(payload) {
      const body = {
        defaults: toApiPayload(payload.defaults ?? this.system),
        branding: payload.branding ?? this.systemBranding,
      }
      const { data } = await themeService.updateSystem(body)
      if (data?.defaults) {
        this.system = fromApiPayload(data.defaults)
        writeCache(SYSTEM_KEY, this.system)
      }
      if (data?.branding) this.systemBranding = { ...this.systemBranding, ...data.branding }
      return this.system
    },

    /** Called on logout — drop the user-specific preview, keep the OS default. */
    clearSession() {
      this.stopWatchingSystemPreference()
    },
  },
})

/** Normalise the store shape into the API contract. */
export function toApiPayload(settings) {
  return {
    theme_mode: settings.mode,
    selected_theme: settings.schemeId,
    custom_colors: settings.custom || null,
    font_family: settings.fontFamily,
    font_size: settings.fontSize,
    font_weight: settings.fontWeight,
    line_height: settings.lineHeight,
    border_radius: settings.radius,
    sidebar_style: settings.sidebar,
    table_density: settings.tableDensity,
    animations_enabled: Boolean(settings.animation),
    calendar_type: settings.calendar,
    layout_preferences: { ...(settings.layout || {}) },
    accessibility_preferences: { ...(settings.accessibility || {}) },
  }
}

/** Inverse of `toApiPayload` — accepts either shape. */
export function fromApiPayload(payload = {}) {
  return sanitise({
    schemeId: payload.selected_theme ?? payload.schemeId,
    mode: payload.theme_mode ?? payload.mode,
    custom: payload.custom_colors ?? payload.custom,
    fontFamily: payload.font_family ?? payload.fontFamily,
    fontSize: payload.font_size ?? payload.fontSize,
    fontWeight: payload.font_weight ?? payload.fontWeight,
    lineHeight: payload.line_height ?? payload.lineHeight,
    radius: payload.border_radius ?? payload.radius,
    sidebar: payload.sidebar_style ?? payload.sidebar,
    tableDensity: payload.table_density ?? payload.tableDensity,
    animation: payload.animations_enabled ?? payload.animation,
    calendar: payload.calendar_type ?? payload.calendar,
    layout: payload.layout_preferences ?? payload.layout,
    accessibility: payload.accessibility_preferences ?? payload.accessibility,
  })
}

export { THEME_SCHEMES, QUICK_COLOR_HEXES }
export default useThemeStore

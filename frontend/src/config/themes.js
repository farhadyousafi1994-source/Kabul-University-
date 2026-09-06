/**
 * ---------------------------------------------------------------------------
 * KU-AMS design-token registry — the single source of truth for every colour,
 * font and shape value used by the application.
 * ---------------------------------------------------------------------------
 *
 * Each preset is a structured token object (never a loose hex scattered through
 * components). The theme store turns the active preset + any user overrides into
 * CSS custom properties on <html>, and `src/css/theme.css` maps those tokens
 * onto Quasar's brand variables and the legacy `--ku-*` aliases, so:
 *
 *   preset → tokens → CSS variables → every component
 *
 * Adding a theme = adding one entry here. Nothing else changes.
 *
 * The 2026 refresh removed the old navy + academic-gold gradient identity in
 * favour of a calm, modern enterprise palette: solid brand colours, soft
 * neutral surfaces, subtle borders and layered shadows, all mode-aware.
 */

/** Complete token set every preset must provide. */
export const COLOR_TOKENS = [
  // Navigation
  'topBarStart', 'topBarEnd', 'sidebarBackground', 'sidebarActive',
  // Brand
  'primary', 'secondary', 'accent', 'accentBackground',
  // Backgrounds
  'background', 'surface', 'card',
  // Typography
  'text', 'textSecondary', 'link',
  // UI elements
  'border', 'hover', 'focus',
  // Status
  'positive', 'negative', 'warning', 'info',
]

/** Derive a light tint of a hex colour — used for hover/focus/accent surfaces. */
export function tint(hex, amount = 0.9, base = '#ffffff') {
  const h = normaliseHex(hex)
  const b = normaliseHex(base)
  if (!h || !b) return hex
  const mix = (i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount)
  return `#${[1, 3, 5].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`
}

/** Darken (negative amount) or lighten a hex colour. */
export function shade(hex, amount = 0.2) {
  const h = normaliseHex(hex)
  if (!h) return hex
  const f = (i) => {
    const v = parseInt(h.slice(i, i + 2), 16)
    const next = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount)
    return Math.max(0, Math.min(255, Math.round(next))).toString(16).padStart(2, '0')
  }
  return `#${[1, 3, 5].map(f).join('')}`
}

export function normaliseHex(value) {
  if (typeof value !== 'string') return null
  let v = value.trim()
  if (v.startsWith('#')) v = v.slice(1)
  if (v.length === 3) v = v.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null
  return `#${v.toLowerCase()}`
}

export const isValidHex = (value) => Boolean(normaliseHex(value))

/** WCAG relative luminance → best readable text colour for a background. */
export function contrastText(background, light = '#ffffff', dark = '#111827') {
  const hex = normaliseHex(background)
  if (!hex) return dark
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return luminance > 0.45 ? dark : light
}

/* ---------------------------------------------------------------------------
 * Neutral surface ramps — shared by every preset so light/dark mode stays
 * consistent no matter which brand colour is active.
 * ------------------------------------------------------------------------- */

export const LIGHT_SURFACES = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#101828',
  textSecondary: '#667085',
  border: '#E4E8EF',
  hover: '#F1F4F9',
}

export const DARK_SURFACES = {
  // Deep neutral — never pure black, so elevation stays readable.
  background: '#121418',
  surface: '#1B1E24',
  card: '#1B1E24',
  text: '#E8ECF4',
  textSecondary: '#98A2B3',
  border: 'rgba(255,255,255,.10)',
  hover: 'rgba(255,255,255,.06)',
}

/**
 * ---------------------------------------------------------------------------
 * ACTION COLOUR SYSTEM
 * ---------------------------------------------------------------------------
 * Meaning → colour, declared once. Buttons, badges, icons and table row actions
 * all read these tokens (`--app-action-<intent>`), so "Excel is green" and
 * "Delete is red" is a property of the design system, not of 40 components.
 */
export const ACTION_COLORS = {
  light: {
    primary: null,     // follows the active brand primary
    save: null,        // → primary
    create: null,      // → primary
    success: '#16A34A',
    excel: '#107C41',  // Microsoft Excel green
    edit: '#2563EB',
    view: '#0891B2',
    info: '#0284C7',
    warning: '#D97706',
    danger: '#DC2626',
    pdf: '#B42318',
    print: '#475569',
    neutral: '#64748B',
    cancel: '#64748B',
  },
  dark: {
    primary: null,
    save: null,
    create: null,
    success: '#22C55E',
    excel: '#22A45D',
    edit: '#60A5FA',
    view: '#22D3EE',
    info: '#38BDF8',
    warning: '#F59E0B',
    danger: '#F16063',
    pdf: '#F87171',
    print: '#94A3B8',
    neutral: '#94A3B8',
    cancel: '#94A3B8',
  },
}

/**
 * Module accent colours — dashboards and module cards use a recognisable hue
 * per domain while staying inside one balanced, desaturated palette.
 */
export const MODULE_ACCENTS = {
  dashboard: '#2563EB',
  general: '#2563EB',
  inventory: '#2563EB',
  assets: '#2563EB',
  sales: '#16A34A',
  warehouse: '#0891B2',
  purchasing: '#7C3AED',
  procurement: '#7C3AED',
  accounting: '#4F46E5',
  financial: '#4F46E5',
  reports: '#0891B2',
  hr: '#EA580C',
  employees: '#EA580C',
  customers: '#0D9488',
  suppliers: '#8B5CF6',
  catalog: '#8B5CF6',
  maintenance: '#D97706',
  audit: '#0EA5E9',
  organization: '#3B82F6',
  administration: '#64748B',
  pharmacy: '#0E9F6E',
  operations: '#0891B2',
}

/**
 * Resolve a module accent from a section key, route name or i18n key —
 * `'nav.sections.operations'`, `'Operations'` and `'operations'` all match.
 * Falls back to the theme primary so an unknown module is never unstyled.
 */
export function moduleAccent(key, fallback = 'var(--app-primary)') {
  if (!key) return fallback
  const slug = String(key).split('.').pop().trim().toLowerCase().replace(/[\s_-]+/g, '')
  return MODULE_ACCENTS[slug] || fallback
}

/** Status → semantic intent, used by badges/chips across every table. */
export const STATUS_INTENTS = {
  active: 'success',
  available: 'success',
  approved: 'success',
  completed: 'success',
  verified: 'success',
  returned: 'success',
  pending: 'warning',
  in_progress: 'warning',
  in_transit: 'warning',
  under_maintenance: 'warning',
  inactive: 'neutral',
  draft: 'neutral',
  disposed: 'neutral',
  cancelled: 'danger',
  rejected: 'danger',
  overdue: 'danger',
  missing: 'danger',
  damaged: 'danger',
  assigned: 'info',
  requested: 'info',
  submitted: 'info',
  reserved: 'info',
}

/**
 * Build the full token set from the handful of colours a preset declares, so
 * presets stay readable and every derived token stays consistent.
 */
export function expandColors({ primary, secondary, accent, topBarStart, topBarEnd, dark = false, ...rest }) {
  const base = {
    primary,
    secondary: secondary || topBarEnd || shade(primary, -0.25),
    accent: accent || secondary || primary,
    topBarStart: topBarStart || shade(primary, -0.45),
    topBarEnd: topBarEnd || topBarStart || shade(primary, -0.45),
  }

  const surfaceLight = { ...LIGHT_SURFACES, focus: tint(base.primary, 0.84) }
  const surfaceDark = { ...DARK_SURFACES, focus: tint(base.primary, 0.72, DARK_SURFACES.surface) }

  return {
    ...base,
    ...(dark ? surfaceDark : surfaceLight),
    accentBackground: dark ? tint(base.accent, 0.86, DARK_SURFACES.surface) : tint(base.accent, 0.92),
    sidebarBackground: dark ? '#171A1F' : '#FFFFFF',
    sidebarActive: tint(base.primary, dark ? 0.82 : 0.9),
    // Interactive text (navigation links, table links, inline links). Defaults
    // to the brand primary, which is always readable on the app surfaces;
    // users can override it from Appearance → Typography.
    link: dark ? tint(base.primary, 0.35, DARK_SURFACES.surface) : base.primary,
    // Status colours are part of the ACTION system: identical in every preset
    // so "green means success" never depends on the chosen theme.
    positive: dark ? ACTION_COLORS.dark.success : ACTION_COLORS.light.success,
    negative: dark ? ACTION_COLORS.dark.danger : ACTION_COLORS.light.danger,
    warning: dark ? ACTION_COLORS.dark.warning : ACTION_COLORS.light.warning,
    info: dark ? ACTION_COLORS.dark.info : ACTION_COLORS.light.info,
    ...rest,
  }
}

const scheme = (id, name, definition, extra = {}) => {
  const colors = expandColors(definition.colors)
  return {
    id,
    name,
    mode: definition.mode || 'light',
    colors,
    // Four strips rendered on the theme card.
    swatch: definition.swatch || [colors.topBarStart, colors.primary, colors.accent, colors.background],
    recommended: Boolean(extra.recommended),
    ...extra,
  }
}

/**
 * Preset themes. `softcora` is the recommended house theme: a modern
 * enterprise identity — a confident blue primary on calm slate navigation and
 * soft neutral surfaces. Every preset is a complete token set, so surfaces are
 * derived rather than hardcoded.
 */
export const THEME_SCHEMES = [
  scheme('softcora', 'SoftCora Default', {
    mode: 'light',
    colors: {
      primary: '#2563EB',
      secondary: '#1D4ED8',
      accent: '#6366F1',
      topBarStart: '#101828',
      topBarEnd: '#101828',
    },
    swatch: ['#101828', '#2563EB', '#6366F1', '#F5F7FA'],
  }, { recommended: true }),

  scheme('indigo', 'Indigo Enterprise', {
    mode: 'light',
    colors: { primary: '#4F46E5', secondary: '#4338CA', accent: '#818CF8', topBarStart: '#1E1B4B', topBarEnd: '#1E1B4B' },
  }),

  scheme('steel', 'Steel Blue', {
    mode: 'light',
    colors: { primary: '#0284C7', secondary: '#0369A1', accent: '#38BDF8', topBarStart: '#0F2A3D', topBarEnd: '#0F2A3D' },
  }),

  scheme('minimal', 'Minimal Mono', {
    mode: 'light',
    colors: { primary: '#1F2937', secondary: '#374151', accent: '#2563EB', topBarStart: '#111827', topBarEnd: '#111827', background: '#FFFFFF' },
  }),

  scheme('forest', 'Forest Green', {
    mode: 'light',
    colors: { primary: '#047857', secondary: '#065F46', accent: '#34D399', topBarStart: '#06281F', topBarEnd: '#06281F' },
  }),

  scheme('royal', 'Royal Purple', {
    mode: 'light',
    colors: { primary: '#7C3AED', secondary: '#6D28D9', accent: '#A78BFA', topBarStart: '#2E1065', topBarEnd: '#2E1065' },
  }),

  scheme('amber', 'Sunrise Amber', {
    mode: 'light',
    colors: { primary: '#D97706', secondary: '#B45309', accent: '#FBBF24', topBarStart: '#26190A', topBarEnd: '#26190A' },
  }),

  scheme('dark', 'Midnight', {
    mode: 'dark',
    colors: { primary: '#3B82F6', secondary: '#60A5FA', accent: '#818CF8', topBarStart: '#15181E', topBarEnd: '#15181E', dark: true },
  }),

  scheme('carbon', 'Carbon Emerald', {
    mode: 'dark',
    colors: { primary: '#10B981', secondary: '#34D399', accent: '#22D3EE', topBarStart: '#14171C', topBarEnd: '#14171C', dark: true },
  }),

  scheme('pastel', 'Soft Pastel', {
    mode: 'light',
    colors: { primary: '#5B7CFA', secondary: '#4C6EF5', accent: '#F0A6A6', topBarStart: '#2B3358', topBarEnd: '#2B3358', background: '#F7F7FB' },
  }),

  scheme('vivid', 'Bold Cobalt', {
    mode: 'light',
    colors: { primary: '#1D4ED8', secondary: '#1E40AF', accent: '#06B6D4', topBarStart: '#0B1F52', topBarEnd: '#0B1F52' },
  }),

  scheme('neutral', 'Graphite', {
    mode: 'light',
    colors: { primary: '#475569', secondary: '#334155', accent: '#0EA5E9', topBarStart: '#1E293B', topBarEnd: '#1E293B', background: '#F6F7F9' },
  }),

  scheme('gradient', 'Aurora', {
    mode: 'light',
    colors: { primary: '#0EA5E9', secondary: '#0284C7', accent: '#10B981', topBarStart: '#0B2434', topBarEnd: '#0B2434' },
  }),

  scheme('crimson', 'Crimson', {
    mode: 'light',
    colors: { primary: '#DC2626', secondary: '#B91C1C', accent: '#FB7185', topBarStart: '#3B0A0A', topBarEnd: '#3B0A0A' },
  }),

  scheme('teal', 'Ocean Teal', {
    mode: 'light',
    colors: { primary: '#0D9488', secondary: '#0F766E', accent: '#2DD4BF', topBarStart: '#0A2F2C', topBarEnd: '#0A2F2C' },
  }),
]

export const DEFAULT_SCHEME_ID = 'softcora'

/** Quick-pick primary colours (the round dots next to the primary control). */
export const QUICK_COLORS = [
  { name: 'Blue', value: '#2563EB' },
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Violet', value: '#7C3AED' },
  { name: 'Cyan', value: '#0891B2' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Rose', value: '#E11D48' },
  { name: 'Slate', value: '#475569' },
]

/** Backwards-compatible flat list of hexes (older callers expect an array). */
export const QUICK_COLOR_HEXES = QUICK_COLORS.map((c) => c.value)

/* ---------------------------------------------------------------------------
 * TYPOGRAPHY
 * ---------------------------------------------------------------------------
 * Fonts are registered per SCRIPT (latin / persian / arabic) so the same
 * interface can be equally polished in English, Farsi, Dari, Pashto and Arabic.
 * `@font-face` declarations and web-font links live in `src/css/fonts.css` and
 * `index.html`; the stacks below always end in a system fallback so text still
 * renders when a CDN is unreachable.
 * ------------------------------------------------------------------------- */

const SYSTEM_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
const PERSIAN_FALLBACK = "'Vazirmatn', 'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif"

/** Latin / English font families. */
export const FONT_FAMILIES = [
  { id: 'inter', name: 'Inter', script: 'latin', stack: `'Inter', ${SYSTEM_FALLBACK}` },
  { id: 'roboto', name: 'Roboto', script: 'latin', stack: `'Roboto', ${SYSTEM_FALLBACK}` },
  { id: 'poppins', name: 'Poppins', script: 'latin', stack: `'Poppins', ${SYSTEM_FALLBACK}` },
  { id: 'open-sans', name: 'Open Sans', script: 'latin', stack: `'Open Sans', ${SYSTEM_FALLBACK}` },
  { id: 'noto-sans', name: 'Noto Sans', script: 'latin', stack: `'Noto Sans', ${SYSTEM_FALLBACK}` },
  { id: 'vazirmatn', name: 'Vazirmatn', script: 'latin', stack: `'Vazirmatn', ${SYSTEM_FALLBACK}`, multilingual: true },
  { id: 'arial', name: 'Arial', script: 'latin', stack: `Arial, Helvetica, ${SYSTEM_FALLBACK}` },
  { id: 'system', name: 'System UI', script: 'latin', stack: `system-ui, ${SYSTEM_FALLBACK}` },
]

/**
 * Farsi / Dari fonts. Vazirmatn is the default: modern, highly legible at small
 * sizes, complete Persian + Arabic-Indic numeral coverage, and it pairs well
 * with Latin text inside the same table cell.
 */
export const PERSIAN_FONTS = [
  { id: 'vazirmatn', name: 'Vazirmatn', native: 'وزیرمتن', stack: `'Vazirmatn', ${PERSIAN_FALLBACK}`, recommended: true },
  { id: 'iransans', name: 'IRANSans', native: 'ایران‌سنس', stack: `'IRANSans', 'IRANSansX', ${PERSIAN_FALLBACK}` },
  { id: 'sahel', name: 'Sahel', native: 'ساحل', stack: `'Sahel', ${PERSIAN_FALLBACK}` },
  { id: 'shabnam', name: 'Shabnam', native: 'شبنم', stack: `'Shabnam', ${PERSIAN_FALLBACK}` },
  { id: 'samim', name: 'Samim', native: 'صمیم', stack: `'Samim', ${PERSIAN_FALLBACK}` },
  { id: 'estedad', name: 'Estedad', native: 'استعداد', stack: `'Estedad', ${PERSIAN_FALLBACK}` },
  { id: 'noto-naskh', name: 'Noto Naskh Arabic', native: 'نسخ', stack: `'Noto Naskh Arabic', ${PERSIAN_FALLBACK}` },
  { id: 'system-fa', name: 'System (Tahoma)', native: 'پیش‌فرض سیستم', stack: `Tahoma, 'Segoe UI', ${PERSIAN_FALLBACK}` },
]

/** Arabic fonts (also used as the Pashto fallback family). */
export const ARABIC_FONTS = [
  { id: 'noto-sans-arabic', name: 'Noto Sans Arabic', native: 'نوتو سانس', stack: `'Noto Sans Arabic', ${PERSIAN_FALLBACK}` },
  { id: 'noto-naskh', name: 'Noto Naskh Arabic', native: 'نسخ', stack: `'Noto Naskh Arabic', ${PERSIAN_FALLBACK}` },
  { id: 'cairo', name: 'Cairo', native: 'القاهرة', stack: `'Cairo', ${PERSIAN_FALLBACK}` },
  { id: 'vazirmatn', name: 'Vazirmatn', native: 'وزیرمتن', stack: `'Vazirmatn', ${PERSIAN_FALLBACK}`, recommended: true },
  { id: 'system-ar', name: 'System (Tahoma)', native: 'النظام', stack: `Tahoma, 'Segoe UI', ${PERSIAN_FALLBACK}` },
]

export const FONT_SCRIPTS = [
  { id: 'latin', fonts: FONT_FAMILIES, defaultId: 'inter' },
  { id: 'persian', fonts: PERSIAN_FONTS, defaultId: 'vazirmatn' },
  { id: 'arabic', fonts: ARABIC_FONTS, defaultId: 'noto-sans-arabic' },
]

/** RTL-safe fallback stack appended to every family. */
export const RTL_FONT_STACK = PERSIAN_FALLBACK

export const FONT_SIZES = { S: '14px', M: '15px', L: '16px', XL: '18px' }

export const LETTER_SPACINGS = {
  tight: '-0.01em',
  normal: '0em',
  relaxed: '0.01em',
  wide: '0.025em',
}

/** Digit rendering: Latin (1234), Persian (۱۲۳۴) or Arabic-Indic (١٢٣٤). */
export const NUMERAL_SYSTEMS = ['auto', 'latin', 'persian', 'arabic']

export const RADII = { sharp: '0px', normal: '10px', round: '16px' }
export const SIDEBAR_STYLES = ['mini', 'normal', 'expanded', 'floating']
export const DENSITIES = ['compact', 'comfortable', 'spacious']
export const DISPLAY_MODES = ['light', 'dark', 'system']
export const CALENDAR_TYPES = ['gregorian', 'solar']
/** Card surface treatment — Appearance → Interface → Card style. */
export const CARD_STYLES = ['elevated', 'flat', 'outlined']
/** Navigation bar treatment — solid neutral, brand colour, or light surface. */
export const NAV_STYLES = ['solid', 'primary', 'light']

/** Typography preferences (persisted inside `layout_preferences.typography`). */
export const DEFAULT_TYPOGRAPHY = {
  persianFont: 'vazirmatn',
  arabicFont: 'noto-sans-arabic',
  letterSpacing: 'normal',
  numerals: 'auto',
  headingWeight: 700,
}

export const DEFAULT_THEME_SETTINGS = {
  schemeId: DEFAULT_SCHEME_ID,
  mode: 'system',
  custom: null,
  fontFamily: 'inter',
  fontSize: 'M',
  fontWeight: 400,
  lineHeight: 1.55,
  radius: 'normal',
  sidebar: 'normal',
  tableDensity: 'compact',
  density: 'compact',
  calendar: 'gregorian',
  animation: true,
  layout: {
    header: 'fixed',
    contentWidth: 'boxed',
    dashboardDensity: 'comfortable',
    cardStyle: 'elevated',
    navigation: 'solid',
    typography: { ...DEFAULT_TYPOGRAPHY },
  },
  accessibility: { highContrast: false, reducedMotion: false, largerText: false, strongFocus: false, keyboardNav: true },
}

export function findScheme(id) {
  return THEME_SCHEMES.find((s) => s.id === id) || THEME_SCHEMES[0]
}

/** Latin font stack for a family id (falls back to the default family). */
export function fontStack(id) {
  return (FONT_FAMILIES.find((f) => f.id === id) || FONT_FAMILIES[0]).stack
}

/** Font stack for a given script ('latin' | 'persian' | 'arabic'). */
export function fontStackFor(script, id) {
  const entry = FONT_SCRIPTS.find((s) => s.id === script) || FONT_SCRIPTS[0]
  const font = entry.fonts.find((f) => f.id === id) || entry.fonts.find((f) => f.id === entry.defaultId) || entry.fonts[0]
  return font.stack
}

/** Locale code → script bucket used for typography and numerals. */
export function scriptForLocale(locale) {
  if (locale === 'fa' || locale === 'ps' || locale === 'prs' || locale === 'fa-AF') return 'persian'
  if (locale === 'ar') return 'arabic'
  return 'latin'
}

export default THEME_SCHEMES

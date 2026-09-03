/**
 * ---------------------------------------------------------------------------
 * KU-AMS theme registry — the single source of truth for every colour used by
 * the application.
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
    topBarEnd: topBarEnd || shade(primary, -0.2),
  }

  const surfaceLight = { background: '#F4F7FB', surface: '#FFFFFF', card: '#FFFFFF', text: '#16233A', textSecondary: '#5C6B84', border: '#E6EAF2', hover: '#EDF1F8', focus: tint(base.primary, 0.82) }
  const surfaceDark = { background: '#121418', surface: '#1D2025', card: '#1D2025', text: '#E8ECF4', textSecondary: '#97A3B8', border: 'rgba(255,255,255,.10)', hover: 'rgba(255,255,255,.06)', focus: tint(base.primary, 0.72, '#1D2025') }

  return {
    ...base,
    ...(dark ? surfaceDark : surfaceLight),
    accentBackground: dark ? tint(base.accent, 0.86, '#1D2025') : tint(base.accent, 0.9),
    sidebarBackground: dark ? '#171A1F' : '#FFFFFF',
    sidebarActive: tint(base.primary, dark ? 0.82 : 0.9),
    // Interactive text (navigation links, table links, inline links). Defaults
    // to the secondary brand colour, which is always the readable-on-surface
    // one; users can override it from Appearance → Typography.
    link: dark ? tint(base.secondary, 0.45, '#1D2025') : base.secondary,
    positive: '#21BA45',
    negative: '#C10015',
    warning: '#F2C037',
    info: '#31CCEC',
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
 * Preset themes. `softcora` is the recommended house theme: the same deep-navy
 * + academic-gold identity the application has always shipped with, expressed
 * as a complete token set so every surface is derived rather than hardcoded.
 */
export const THEME_SCHEMES = [
  scheme('softcora', 'SoftCora Default', {
    mode: 'light',
    colors: {
      primary: '#C8862D',
      secondary: '#175A8C',
      accent: '#0B1626',
      topBarStart: '#123A66',
      topBarEnd: '#175A8C',
      accentBackground: '#F4F7FB',
      background: '#F4F7FB',
    },
    swatch: ['#123A66', '#175A8C', '#C8862D', '#F4F7FB'],
  }, { recommended: true }),

  scheme('steel', 'Steel Blue', {
    mode: 'light',
    colors: { primary: '#C8862D', secondary: '#175A8C', accent: '#0B1626', topBarStart: '#123A66', topBarEnd: '#175A8C', accentBackground: '#F4F7FB' },
    swatch: ['#123A66', '#175A8C', '#C8862D', '#0B1626', '#F4F7FB'],
  }),

  scheme('minimal', 'Minimal', {
    mode: 'light',
    colors: { primary: '#2E5BFF', secondary: '#1A1A1A', accent: '#2E5BFF', topBarStart: '#1A1A1A', topBarEnd: '#2E5BFF', background: '#FFFFFF', accentBackground: '#FFFFFF' },
    swatch: ['#1A1A1A', '#2E5BFF', '#2E5BFF', '#FFFFFF'],
  }),

  scheme('forest', 'Forest Green', {
    mode: 'light',
    colors: { primary: '#2E7D32', secondary: '#66A56B', accent: '#66A56B', topBarStart: '#1E4620', topBarEnd: '#0D2A0E', accentBackground: '#E8F5E9', background: '#FFFFFF' },
  }),

  scheme('royal', 'Royal Purple', {
    mode: 'light',
    colors: { primary: '#7C3AED', secondary: '#A78BFA', accent: '#A78BFA', topBarStart: '#4C1D95', topBarEnd: '#6D28D9', accentBackground: '#F3EEFB', background: '#FFFFFF' },
  }),

  scheme('amber', 'Sunset Amber', {
    mode: 'light',
    colors: { primary: '#E07A1F', secondary: '#F0A855', accent: '#F0A855', topBarStart: '#8A4A0E', topBarEnd: '#C2660F', accentBackground: '#FFF4E6', background: '#FFFFFF' },
  }),

  scheme('dark', 'Dark Mode', {
    mode: 'dark',
    colors: { primary: '#2E7D64', secondary: '#8AE0C2', accent: '#8AE0C2', topBarStart: '#1A1B1E', topBarEnd: '#22242A', dark: true },
  }),

  scheme('pastel', 'Pastel', {
    mode: 'light',
    colors: { primary: '#2F6E4E', secondary: '#7FA98F', accent: '#E29A6E', topBarStart: '#2F6E4E', topBarEnd: '#4C8A6A', accentBackground: '#FBEAE6', background: '#FDF8F6' },
  }),

  scheme('vivid', 'Bold', {
    mode: 'light',
    colors: { primary: '#2A5BFF', secondary: '#0EA5E9', accent: '#2A5BFF', topBarStart: '#1E3A8A', topBarEnd: '#2A5BFF', accentBackground: '#E4EAFF', background: '#FFFFFF' },
  }),

  scheme('neutral', 'Neutral', {
    mode: 'light',
    colors: { primary: '#7A5C3A', secondary: '#A98C63', accent: '#A98C63', topBarStart: '#5A4632', topBarEnd: '#7A5C3A', accentBackground: '#F2E9DE', background: '#FBF8F4' },
  }),

  scheme('gradient', 'Gradient', {
    mode: 'light',
    colors: { primary: '#10B981', secondary: '#34D399', accent: '#FCD34D', topBarStart: '#10B981', topBarEnd: '#0EA5E9', accentBackground: '#ECFDF5', background: '#FFFFFF' },
  }),

  scheme('crimson', 'Crimson', {
    mode: 'light',
    colors: { primary: '#B91C1C', secondary: '#F87171', accent: '#F87171', topBarStart: '#7F1D1D', topBarEnd: '#B91C1C', accentBackground: '#FDEEEE', background: '#FFFFFF' },
  }),

  scheme('teal', 'Ocean Teal', {
    mode: 'light',
    colors: { primary: '#0D9488', secondary: '#2DD4BF', accent: '#2DD4BF', topBarStart: '#134E4A', topBarEnd: '#0F766E', accentBackground: '#E6FAF8', background: '#FFFFFF' },
  }),
]

export const DEFAULT_SCHEME_ID = 'softcora'

/** Quick-pick primary colours (the round dots next to the primary control). */
export const QUICK_COLORS = [
  { name: 'Blue', value: '#2563EB' },
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Gold', value: '#C8862D' },
]

/** Backwards-compatible flat list of hexes (older callers expect an array). */
export const QUICK_COLOR_HEXES = QUICK_COLORS.map((c) => c.value)

export const FONT_FAMILIES = [
  { id: 'inter', name: 'Inter', stack: "'Inter', 'Roboto', -apple-system, 'Segoe UI', sans-serif" },
  { id: 'roboto', name: 'Roboto', stack: "'Roboto', -apple-system, 'Segoe UI', sans-serif" },
  { id: 'poppins', name: 'Poppins', stack: "'Poppins', 'Roboto', -apple-system, 'Segoe UI', sans-serif" },
  { id: 'open-sans', name: 'Open Sans', stack: "'Open Sans', 'Roboto', -apple-system, 'Segoe UI', sans-serif" },
  { id: 'noto-sans', name: 'Noto Sans', stack: "'Noto Sans', 'Roboto', -apple-system, 'Segoe UI', sans-serif" },
  { id: 'arial', name: 'Arial', stack: "Arial, Helvetica, 'Segoe UI', sans-serif" },
]

/** RTL-safe fallback stack appended to every family. */
export const RTL_FONT_STACK = "'Segoe UI', Tahoma, 'Vazirmatn', 'Noto Sans Arabic', 'Noto Naskh Arabic', Arial, sans-serif"

export const FONT_SIZES = { S: '14px', M: '15px', L: '16px', XL: '18px' }
export const RADII = { sharp: '0px', normal: '10px', round: '16px' }
export const SIDEBAR_STYLES = ['mini', 'normal', 'expanded', 'floating']
export const DENSITIES = ['compact', 'comfortable', 'spacious']
export const DISPLAY_MODES = ['light', 'dark', 'system']
export const CALENDAR_TYPES = ['gregorian', 'solar']

export const DEFAULT_THEME_SETTINGS = {
  schemeId: DEFAULT_SCHEME_ID,
  mode: 'system',
  custom: null,
  fontFamily: 'roboto',
  fontSize: 'M',
  fontWeight: 400,
  lineHeight: 1.5,
  radius: 'normal',
  sidebar: 'normal',
  tableDensity: 'compact',
  density: 'compact',
  calendar: 'gregorian',
  animation: true,
  layout: { header: 'fixed', contentWidth: 'boxed', dashboardDensity: 'comfortable' },
  accessibility: { highContrast: false, reducedMotion: false, largerText: false, strongFocus: false, keyboardNav: true },
}

export function findScheme(id) {
  return THEME_SCHEMES.find((s) => s.id === id) || THEME_SCHEMES[0]
}

export function fontStack(id) {
  return (FONT_FAMILIES.find((f) => f.id === id) || FONT_FAMILIES[1]).stack
}

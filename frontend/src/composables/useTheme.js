import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from 'src/stores/theme'
import {
  COLOR_TOKENS,
  FONT_FAMILIES,
  QUICK_COLORS,
  THEME_SCHEMES,
} from 'src/config/themes'

/**
 * ---------------------------------------------------------------------------
 * useTheme — view-model helpers for the Theme & Appearance centre and any
 * component that needs to react to the active appearance.
 * ---------------------------------------------------------------------------
 *
 * Keeps every option list (display modes, font sizes, densities, colour token
 * groups…) in one place so the page template stays declarative and the store
 * stays free of presentation concerns.
 */

const COLOUR_GROUPS = [
  { key: 'navigation', tokens: ['topBarStart', 'topBarEnd', 'sidebarBackground', 'sidebarActive'] },
  { key: 'brand', tokens: ['primary', 'secondary', 'accent'] },
  { key: 'backgrounds', tokens: ['background', 'surface', 'card'] },
  { key: 'typography', tokens: ['text', 'textSecondary'] },
  { key: 'ui', tokens: ['border', 'hover', 'focus'] },
  { key: 'status', tokens: ['positive', 'negative', 'warning', 'info'] },
]

/** Colour token → i18n key inside `theme.colours.*`. */
export function tokenLabelKey(token) {
  const map = {
    topBarStart: 'topBarStart',
    topBarEnd: 'topBarEnd',
    sidebarBackground: 'sidebarBackground',
    sidebarActive: 'sidebarActive',
    primary: 'primary',
    secondary: 'secondary',
    accent: 'accent',
    background: 'background',
    surface: 'surface',
    card: 'card',
    text: 'textPrimary',
    textSecondary: 'textSecondary',
    border: 'border',
    hover: 'hover',
    focus: 'focus',
    positive: 'success',
    negative: 'error',
    warning: 'warning',
    info: 'information',
  }
  return `theme.colours.${map[token] || token}`
}

export function useTheme() {
  const { t } = useI18n()
  const theme = useThemeStore()

  const modeOptions = computed(() => [
    { value: 'light', label: t('theme.light'), icon: 'light_mode' },
    { value: 'dark', label: t('theme.dark'), icon: 'dark_mode' },
    { value: 'system', label: t('theme.system'), icon: 'desktop_windows' },
  ])

  const fontSizeOptions = computed(() => [
    { value: 'S', label: 'S', tooltip: t('theme.sizeS') },
    { value: 'M', label: 'M', tooltip: t('theme.sizeM') },
    { value: 'L', label: 'L', tooltip: t('theme.sizeL') },
    { value: 'XL', label: 'XL', tooltip: t('theme.sizeXL') },
  ])

  const radiusOptions = computed(() => [
    { value: 'sharp', label: t('theme.sharp'), icon: 'crop_square' },
    { value: 'normal', label: t('theme.normal'), icon: 'rounded_corner' },
    { value: 'round', label: t('theme.round'), icon: 'circle' },
  ])

  const sidebarOptions = computed(() => [
    { value: 'mini', label: t('theme.mini'), icon: 'view_sidebar' },
    { value: 'normal', label: t('theme.sidebarNormal'), icon: 'view_day' },
    { value: 'expanded', label: t('theme.expanded'), icon: 'view_week' },
    { value: 'floating', label: t('theme.floating'), icon: 'picture_in_picture' },
  ])

  const densityOptions = computed(() => [
    { value: 'compact', label: t('theme.compact'), icon: 'view_agenda' },
    { value: 'comfortable', label: t('theme.comfortable'), icon: 'view_headline' },
    { value: 'spacious', label: t('theme.spacious'), icon: 'view_stream' },
  ])

  const calendarOptions = computed(() => [
    { value: 'gregorian', label: t('theme.gregorian'), icon: 'calendar_today' },
    { value: 'solar', label: t('theme.solar'), icon: 'wb_sunny' },
  ])

  const animationOptions = computed(() => [
    { value: 'on', label: t('theme.on'), icon: 'play_arrow' },
    { value: 'off', label: t('theme.off'), icon: 'pause' },
  ])

  const headerOptions = computed(() => [
    { value: 'fixed', label: t('theme.headerFixed') },
    { value: 'sticky', label: t('theme.headerSticky') },
    { value: 'normal', label: t('theme.headerNormal') },
  ])

  const contentWidthOptions = computed(() => [
    { value: 'boxed', label: t('theme.boxed') },
    { value: 'full', label: t('theme.fullWidth') },
  ])

  const accessibilityOptions = computed(() => [
    { key: 'highContrast', label: t('theme.highContrast'), hint: t('theme.accessibilityHint') },
    { key: 'reducedMotion', label: t('theme.reducedMotion'), hint: t('theme.animationsHint') },
    { key: 'largerText', label: t('theme.largerText'), hint: t('theme.fontSizeHint') },
    { key: 'strongFocus', label: t('theme.strongFocus'), hint: t('theme.keyboardNav') },
    { key: 'keyboardNav', label: t('theme.keyboardNav'), hint: t('theme.accessibilityHint') },
  ])

  const colorGroups = computed(() =>
    COLOUR_GROUPS.map((group) => ({
      ...group,
      tokens: group.tokens.filter((token) => COLOR_TOKENS.includes(token)),
    })),
  )

  const fontFamilyOptions = computed(() =>
    FONT_FAMILIES.map((family) => ({ label: family.name, value: family.id, stack: family.stack })),
  )

  const schemeOptions = computed(() =>
    THEME_SCHEMES.map((scheme) => ({
      label: scheme.recommended ? `${scheme.name} · ${t('theme.recommended')}` : scheme.name,
      value: scheme.id,
    })),
  )

  /** Palette offered by every QColor instance: quick picks + active scheme. */
  const palette = computed(() => {
    const colors = theme.colors || {}
    return [
      ...QUICK_COLORS.map((c) => c.value),
      colors.primary,
      colors.secondary,
      colors.accent,
      colors.topBarStart,
      colors.topBarEnd,
      colors.positive,
      colors.negative,
      colors.warning,
      colors.info,
    ].filter(Boolean)
  })

  return {
    theme,
    schemes: THEME_SCHEMES,
    quickColors: QUICK_COLORS,
    colorTokens: COLOR_TOKENS,
    modeOptions,
    fontSizeOptions,
    radiusOptions,
    sidebarOptions,
    densityOptions,
    calendarOptions,
    animationOptions,
    headerOptions,
    contentWidthOptions,
    accessibilityOptions,
    colorGroups,
    fontFamilyOptions,
    schemeOptions,
    palette,
    tokenLabelKey,
  }
}

/**
 * useSystemAppearance — for components that only need to *react* to the active
 * appearance (e.g. the layout following `sidebarStyle` or `resolvedMode`).
 * Loads the persisted preferences once on mount if they have not been fetched.
 */
export function useSystemAppearance() {
  const theme = useThemeStore()

  onMounted(() => {
    theme.applyInitial()
    if (!theme.loaded) theme.loadTheme({ silent: true })
  })

  onBeforeUnmount(() => {
    // The media-query listener is owned by the store, not by this component,
    // so it deliberately survives unmount (the app keeps following the OS).
  })

  return {
    theme,
    isDark: computed(() => theme.isDark),
    sidebarStyle: computed(() => theme.settings.sidebar),
    isMini: computed(() => theme.settings.sidebar === 'mini'),
    isFloating: computed(() => theme.settings.sidebar === 'floating'),
    isExpanded: computed(() => theme.settings.sidebar === 'expanded'),
    headerMode: computed(() => theme.settings.layout?.header || 'fixed'),
    contentWidth: computed(() => theme.settings.layout?.contentWidth || 'boxed'),
    calendarType: computed(() => theme.settings.calendar),
    density: computed(() => theme.settings.tableDensity),
  }
}

export default useTheme

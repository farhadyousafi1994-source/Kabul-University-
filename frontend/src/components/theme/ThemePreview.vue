<template>
  <div class="tp" :class="{ 'tp--dark': dark }" :style="vars">
    <div class="tp__frame">
      <!-- Top navigation ------------------------------------------------- -->
      <div class="tp__topbar">
        <q-icon name="menu" size="16px" class="tp__topbar-icon" />
        <q-icon name="account_balance" size="16px" class="tp__topbar-icon" />
        <span class="tp__brand">{{ brandName || t('theme.previewBrand') }}</span>
        <span class="tp__spacer" />
        <span class="tp__chip">{{ t('theme.previewInfo') }}</span>
        <span class="tp__dot" />
        <span class="tp__dot" />
        <span class="tp__avatar">{{ initials }}</span>
      </div>

      <div class="tp__body">
        <!-- Sidebar -------------------------------------------------------- -->
        <div class="tp__sidebar">
          <div class="tp__nav tp__nav--active">
            <q-icon name="dashboard" size="13px" />
            <span v-if="!mini">{{ t('nav.items.dashboard') }}</span>
          </div>
          <div class="tp__nav">
            <q-icon name="inventory_2" size="13px" />
            <span v-if="!mini">{{ t('nav.items.assets') }}</span>
          </div>
          <div class="tp__nav">
            <q-icon name="assignment_ind" size="13px" />
            <span v-if="!mini">{{ t('nav.items.assignments') }}</span>
          </div>
          <div class="tp__nav">
            <q-icon name="build" size="13px" />
            <span v-if="!mini">{{ t('nav.items.maintenance') }}</span>
          </div>
        </div>

        <!-- Content -------------------------------------------------------- -->
        <div class="tp__content">
          <div class="tp__heading">
            <div class="tp__title">{{ t('nav.items.dashboard') }}</div>
            <div class="tp__subtitle">{{ t('theme.previewHint') }}</div>
          </div>

          <div class="tp__cards">
            <div class="tp__card">
              <div class="tp__accent" />
              <div class="tp__card-body">
                <div class="tp__card-label">{{ t('theme.previewCard') }}</div>
                <div class="tp__card-value">8</div>
              </div>
              <q-icon name="folder_open" size="18px" class="tp__card-icon" />
            </div>
            <div class="tp__card">
              <div class="tp__accent tp__accent--alt" />
              <div class="tp__card-body">
                <div class="tp__card-label">{{ t('assignments.statActive') }}</div>
                <div class="tp__card-value">24</div>
              </div>
              <q-icon name="check_circle" size="18px" class="tp__card-icon" />
            </div>
          </div>

          <div class="tp__row">
            <button class="tp__btn tp__btn--primary">{{ t('theme.previewSave') }}</button>
            <button class="tp__btn tp__btn--outline">{{ t('theme.previewCancel') }}</button>
            <span class="tp__spacer" />
            <span class="tp__status">
              <span class="tp__status-dot" />
              {{ t('theme.previewStatus') }}
            </span>
          </div>

          <div class="tp__type">
            <span class="tp__type-a">Aa</span>
            <span class="tp__type-b">Aa</span>
            <span class="tp__type-sample">{{ sampleText }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Live theme preview — a miniature of the real application shell (top bar,
 * sidebar, dashboard cards, buttons, status chip, typography) rendered with
 * the CURRENT PREVIEW tokens, so every change is visible instantly without
 * touching the rest of the page.
 *
 * All colours come in through local CSS custom properties scoped to `.tp`,
 * which keeps the preview honest even before the user presses Save.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from 'src/stores/theme'
import { FONT_SIZES, RADII, contrastText, fontStack } from 'src/config/themes'

const props = defineProps({
  brandName: { type: String, default: '' },
  initials: { type: String, default: 'SC' },
  sampleText: { type: String, default: 'Kabul University · Asset Management System' },
})

const { t } = useI18n()
const theme = useThemeStore()

const dark = computed(() => theme.resolvedMode === 'dark')
const mini = computed(() => theme.settings.sidebar === 'mini')

const vars = computed(() => {
  const c = theme.colors
  const s = theme.settings
  const bg = dark.value ? '#121418' : c.background
  const surface = dark.value ? '#1d2025' : c.surface
  const text = dark.value ? '#e8ecf4' : c.text
  const muted = dark.value ? '#97a3b8' : c.textSecondary
  const border = dark.value ? 'rgba(255,255,255,.12)' : c.border
  const radius = RADII[s.radius] || RADII.normal

  return {
    '--tp-primary': c.primary,
    '--tp-on-primary': contrastText(c.primary),
    '--tp-secondary': c.secondary,
    '--tp-accent': c.accent,
    '--tp-topbar-start': c.topBarStart,
    '--tp-topbar-end': c.topBarEnd,
    '--tp-topbar-text': contrastText(c.topBarStart),
    '--tp-sidebar': dark.value ? '#171a1f' : c.sidebarBackground,
    '--tp-sidebar-active': dark.value ? 'rgba(255,255,255,.08)' : c.accentBackground,
    '--tp-bg': bg,
    '--tp-surface': surface,
    '--tp-card': dark.value ? '#22252b' : c.card,
    '--tp-text': text,
    '--tp-muted': muted,
    '--tp-border': border,
    '--tp-positive': c.positive,
    '--tp-radius': radius,
    '--tp-font': fontStack(s.fontFamily),
    // Preview scale is intentionally capped so it never overflows the card.
    '--tp-scale': `clamp(11px, ${parseFloat(FONT_SIZES[s.fontSize] || '15px') - 3}px, 14px)`,
    '--tp-sidebar-width': mini.value ? '34px' : s.sidebar === 'expanded' ? '112px' : '88px',
  }
})
</script>

<style lang="sass" scoped>
.tp
  font-family: var(--tp-font)
  font-size: var(--tp-scale)
  color: var(--tp-text)

  &__frame
    border: 1px solid var(--tp-border)
    border-radius: calc(var(--tp-radius) + 2px)
    overflow: hidden
    background: var(--tp-bg)
    box-shadow: var(--ku-shadow-sm)

  &__topbar
    display: flex
    align-items: center
    gap: 6px
    padding: 7px 10px
    color: var(--tp-topbar-text)
    background: linear-gradient(115deg, var(--tp-topbar-start) 0%, var(--tp-topbar-end) 100%)

  &__topbar-icon
    opacity: .85

  &__brand
    font-weight: 700
    letter-spacing: .2px

  &__chip
    padding: 1px 8px
    border-radius: 999px
    font-size: .85em
    font-weight: 600
    background: rgba(255, 255, 255, .16)
    border: 1px solid rgba(255, 255, 255, .22)

  &__dot
    width: 6px
    height: 6px
    border-radius: 50%
    background: rgba(255, 255, 255, .55)

  &__avatar
    width: 18px
    height: 18px
    border-radius: 50%
    display: flex
    align-items: center
    justify-content: center
    font-size: .7em
    font-weight: 800
    color: var(--tp-topbar-start)
    background: rgba(255, 255, 255, .85)

  &__spacer
    flex: 1

  &__body
    display: flex
    align-items: stretch
    min-height: 148px

  &__sidebar
    width: var(--tp-sidebar-width)
    flex: 0 0 auto
    padding: 8px 6px
    background: var(--tp-sidebar)
    border-inline-end: 1px solid var(--tp-border)
    display: flex
    flex-direction: column
    gap: 3px
    transition: width .15s ease

  &__nav
    display: flex
    align-items: center
    gap: 5px
    padding: 4px 6px
    border-radius: var(--tp-radius)
    color: var(--tp-muted)
    white-space: nowrap
    overflow: hidden

    &--active
      background: var(--tp-sidebar-active)
      color: var(--tp-primary)
      font-weight: 700

  &__content
    flex: 1
    min-width: 0
    padding: 9px 10px
    display: flex
    flex-direction: column
    gap: 8px

  &__title
    font-size: 1.25em
    font-weight: 800
    line-height: 1.2

  &__subtitle
    color: var(--tp-muted)
    font-size: .9em

  &__cards
    display: flex
    gap: 8px
    flex-wrap: wrap

  &__card
    position: relative
    flex: 1 1 120px
    min-width: 0
    display: flex
    align-items: center
    gap: 8px
    padding: 8px 10px
    background: var(--tp-card)
    border: 1px solid var(--tp-border)
    border-radius: var(--tp-radius)
    overflow: hidden

  &__accent
    position: absolute
    inset-block: 0
    inset-inline-start: 0
    width: 3px
    background: var(--tp-primary)

    &--alt
      background: var(--tp-accent)

  &__card-body
    min-width: 0

  &__card-label
    color: var(--tp-muted)
    font-size: .85em
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  &__card-value
    font-size: 1.5em
    font-weight: 800
    line-height: 1.1
    color: var(--tp-primary)

  &__card-icon
    margin-inline-start: auto
    color: var(--tp-muted)

  &__row
    display: flex
    align-items: center
    gap: 6px
    flex-wrap: wrap

  &__btn
    border: none
    cursor: default
    padding: 4px 12px
    border-radius: var(--tp-radius)
    font-family: inherit
    font-size: .9em
    font-weight: 700

    &--primary
      background: var(--tp-primary)
      color: var(--tp-on-primary)

    &--outline
      background: transparent
      color: var(--tp-primary)
      border: 1px solid color-mix(in srgb, var(--tp-primary) 45%, transparent)

  &__status
    display: inline-flex
    align-items: center
    gap: 4px
    padding: 2px 9px
    border-radius: 999px
    font-size: .85em
    font-weight: 700
    color: var(--tp-positive)
    background: color-mix(in srgb, var(--tp-positive) 14%, transparent)
    border: 1px solid color-mix(in srgb, var(--tp-positive) 35%, transparent)

  &__status-dot
    width: 6px
    height: 6px
    border-radius: 50%
    background: currentColor

  &__type
    display: flex
    align-items: baseline
    gap: 8px
    padding-top: 2px
    border-top: 1px dashed var(--tp-border)

  &__type-a
    font-size: 1.35em
    font-weight: 800

  &__type-b
    font-size: 1.35em
    font-weight: 300
    color: var(--tp-muted)

  &__type-sample
    color: var(--tp-muted)
    font-size: .85em
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
</style>

<template>
  <q-card class="app-card app-card--interactive app-kpi full-height" :class="accentClass" flat>
    <q-card-section class="row items-center no-wrap app-kpi__section">
      <div class="app-icon-tile q-mr-md">
        <q-icon :name="icon" size="24px" />
      </div>
      <div class="col min-width-0">
        <div class="app-kpi__value" :class="{ 'app-kpi__value--small': small }">{{ value }}</div>
        <div class="app-kpi__label ellipsis">{{ label }}</div>
        <div v-if="description" class="app-kpi__desc ellipsis-2-lines">{{ description }}</div>
      </div>
      <div v-if="side || trend" class="column items-end q-pl-sm">
        <div
          v-if="trend"
          class="app-kpi__trend"
          :class="trendDirection > 0 ? 'app-kpi__trend--up' : trendDirection < 0 ? 'app-kpi__trend--down' : ''"
        >
          <q-icon :name="trendDirection > 0 ? 'trending_up' : trendDirection < 0 ? 'trending_down' : 'trending_flat'" size="14px" />
          {{ trend }}
        </div>
        <div v-else-if="side" class="app-kpi__side">{{ side }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

/**
 * KPI / statistic card.
 *
 * Colour comes from the shared accent palette (`.app-accent-*`), which tints
 * the icon tile and the hover border while the card surface itself stays a
 * clean neutral — colourful, but never noisy. Pass either an accent name
 * ("blue", "green", …) or a legacy Quasar colour ("primary", "positive", …).
 */
const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, default: 'inventory_2' },
  /** Accent name or legacy Quasar palette colour. */
  color: { type: String, default: 'primary' },
  /** Background tone — kept for backwards compatibility, no longer used. */
  tone: { type: String, default: 'white' },
  /** Optional small side annotation (e.g. a percentage). */
  side: { type: String, default: '' },
  /** Compact value font for long numbers (currencies etc.). */
  small: { type: Boolean, default: false },
  /** Optional secondary line under the label. */
  description: { type: String, default: '' },
  /** Optional trend chip, e.g. "+12%" / "-3%". Sign drives the arrow/color. */
  trend: { type: String, default: '' },
})

/** Legacy Quasar palette names → design-system accents. */
const LEGACY_ACCENTS = {
  primary: '',
  secondary: 'indigo',
  accent: 'violet',
  positive: 'green',
  negative: 'rose',
  warning: 'amber',
  info: 'cyan',
  'deep-orange': 'orange',
  'blue-grey': 'slate',
  brown: 'orange',
  'grey-6': 'slate',
  'grey-7': 'slate',
  'grey-8': 'slate',
  'green-7': 'green',
}

const ACCENTS = ['blue', 'indigo', 'violet', 'purple', 'cyan', 'teal', 'green', 'emerald', 'amber', 'orange', 'rose', 'slate']

const accentClass = computed(() => {
  const color = props.color || 'primary'
  if (ACCENTS.includes(color)) return `app-accent-${color}`
  const mapped = LEGACY_ACCENTS[color]
  return mapped ? `app-accent-${mapped}` : ''
})

const trendDirection = computed(() => {
  const n = Number.parseFloat(String(props.trend).replace(',', '.'))
  return Number.isFinite(n) ? Math.sign(n) : 0
})
</script>

<style lang="sass" scoped>
.min-width-0
  min-width: 0

.app-kpi
  &__section
    padding: var(--app-card-padding)

  &__value
    font-size: 1.5rem
    font-weight: 750
    line-height: 1.15
    color: var(--app-text-primary)
    font-variant-numeric: tabular-nums

    &--small
      font-size: 1.15rem !important

  &__label
    font-size: var(--app-text-caption)
    font-weight: 600
    color: var(--app-text-secondary)
    letter-spacing: .01em
    margin-top: 2px

  &__desc
    font-size: var(--app-text-caption)
    color: var(--app-text-muted)
    margin-top: 2px

  &__side
    font-size: var(--app-text-small)
    font-weight: 700
    padding: 3px 8px
    border-radius: var(--app-radius-sm)
    background: color-mix(in srgb, var(--accent, var(--app-primary)) 12%, transparent)
    color: var(--accent, var(--app-primary))

  &__trend
    display: inline-flex
    align-items: center
    gap: 2px
    font-size: var(--app-text-caption)
    font-weight: 700
    padding: 3px 8px
    border-radius: var(--app-radius-pill)
    background: color-mix(in srgb, var(--app-text-secondary) 12%, transparent)
    color: var(--app-text-secondary)

    &--up
      background: color-mix(in srgb, var(--app-action-success) 13%, transparent)
      color: var(--app-action-success)

    &--down
      background: color-mix(in srgb, var(--app-action-danger) 13%, transparent)
      color: var(--app-action-danger)
</style>

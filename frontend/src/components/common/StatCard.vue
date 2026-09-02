<template>
  <q-card class="stat-card kpi-card full-height" flat>
    <q-card-section class="row items-center no-wrap q-pa-md">
      <div class="kpi-card__tile q-mr-md" :class="`kpi-card__tile--${toneClass}`">
        <q-icon :name="icon" size="26px" />
      </div>
      <div class="col min-width-0">
        <div class="kpi-card__value" :class="{ 'kpi-card__value--small': small }">{{ value }}</div>
        <div class="kpi-card__label ellipsis">{{ label }}</div>
        <div v-if="description" class="kpi-card__desc ellipsis-2-lines">{{ description }}</div>
      </div>
      <div v-if="side || trend" class="column items-end q-pl-sm">
        <div
          v-if="trend"
          class="kpi-card__trend"
          :class="trendDirection > 0 ? 'kpi-card__trend--up' : trendDirection < 0 ? 'kpi-card__trend--down' : ''"
        >
          <q-icon :name="trendDirection > 0 ? 'trending_up' : trendDirection < 0 ? 'trending_down' : 'trending_flat'" size="14px" />
          {{ trend }}
        </div>
        <div v-else-if="side" class="kpi-card__side" :class="`text-${color}`">{{ side }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, default: 'inventory_2' },
  color: { type: String, default: 'primary' },
  /** Background tone — "white" (default) keeps the clean card surface. */
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

const trendDirection = computed(() => {
  const n = Number.parseFloat(String(props.trend).replace(',', '.'))
  return Number.isFinite(n) ? Math.sign(n) : 0
})

// The icon tile mixes the named color over the card surface (works for any
// Quasar palette color; dark mode mixes over the dark surface).
const toneClass = computed(() => props.color)
</script>

<style lang="sass" scoped>
.min-width-0
  min-width: 0

.kpi-card
  &__tile
    width: 48px
    height: 48px
    min-width: 48px
    border-radius: calc(var(--ku-radius, 10px) + 2px)
    display: flex
    align-items: center
    justify-content: center
    background: color-mix(in srgb, var(--q-primary) 12%, var(--ku-card-bg))
    color: var(--q-primary)

  &__value
    font-size: 24px
    font-weight: 800
    line-height: 1.15
    color: var(--ku-ink)
    font-variant-numeric: tabular-nums

    &--small
      font-size: 19px !important

  &__label
    font-size: 12px
    font-weight: 600
    color: var(--ku-ink-soft)
    letter-spacing: .2px

  &__desc
    font-size: 11px
    color: var(--ku-ink-soft)
    margin-top: 2px

  &__side
    font-size: 13px
    font-weight: 700
    padding: 4px 8px
    border-radius: 8px
    background: color-mix(in srgb, currentColor 10%, transparent)

  &__trend
    display: inline-flex
    align-items: center
    gap: 2px
    font-size: 12px
    font-weight: 700
    padding: 3px 8px
    border-radius: 999px
    background: color-mix(in srgb, var(--ku-ink-soft) 12%, transparent)
    color: var(--ku-ink-soft)

    &--up
      background: color-mix(in srgb, var(--q-positive) 12%, transparent)
      color: var(--q-positive)

    &--down
      background: color-mix(in srgb, var(--q-negative) 12%, transparent)
      color: var(--q-negative)

.body--dark
  .kpi-card__tile
    background: color-mix(in srgb, var(--q-primary) 22%, #1e2126)
</style>

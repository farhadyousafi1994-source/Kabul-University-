<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    class="stat-tile"
    :class="[`stat-tile--${color}`, { 'stat-tile--active': active, 'stat-tile--interactive': interactive }]"
    :aria-pressed="interactive ? String(active) : undefined"
    @click="interactive ? $emit('select') : null"
  >
    <span class="stat-tile__icon">
      <q-icon :name="icon" size="20px" />
    </span>

    <span class="stat-tile__body">
      <span class="stat-tile__label">{{ label }}</span>
      <span class="stat-tile__value">
        <q-skeleton v-if="loading" type="text" width="52px" />
        <template v-else>{{ display }}</template>
      </span>
      <span v-if="hint" class="stat-tile__hint">{{ hint }}</span>
    </span>

    <span
      v-if="trend"
      class="stat-tile__trend"
      :class="trendDirection > 0 ? 'is-up' : trendDirection < 0 ? 'is-down' : ''"
    >
      <q-icon :name="trendDirection > 0 ? 'trending_up' : trendDirection < 0 ? 'trending_down' : 'trending_flat'" size="13px" />
      {{ trend }}
    </span>

    <q-icon v-else-if="active" name="filter_alt" size="16px" class="stat-tile__filter-mark" />
  </component>
</template>

<script setup>
/**
 * One professional summary card.
 *
 * Interactive cards (those with a filter) render as a real <button> so keyboard
 * users get focus, Enter/Space and `aria-pressed` for free — clicking never
 * navigates or reloads, it only emits `select`.
 */
import { computed } from 'vue'
import { currency as formatCurrency } from 'src/utils/format'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: 0 },
  icon: { type: String, default: 'insights' },
  /** Quasar palette colour chosen by MEANING (positive / warning / negative…). */
  color: { type: String, default: 'primary' },
  /** 'number' | 'currency' */
  format: { type: String, default: 'number' },
  /** Secondary line, e.g. "of 1,250 total". */
  hint: { type: String, default: '' },
  /** Optional trend chip, e.g. "+12". The sign drives arrow and colour. */
  trend: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
})

defineEmits(['select'])

const display = computed(() => {
  const n = Number(props.value)
  if (!Number.isFinite(n)) return props.value ?? '—'
  return props.format === 'currency' ? formatCurrency(n) : n.toLocaleString()
})

const trendDirection = computed(() => {
  const n = Number.parseFloat(String(props.trend).replace(',', '.'))
  return Number.isFinite(n) ? Math.sign(n) : 0
})
</script>

<style lang="sass" scoped>
.stat-tile
  --tone: var(--q-primary)
  display: flex
  align-items: center
  gap: 12px
  width: 100%
  text-align: start
  padding: 14px
  border: 1px solid var(--app-border)
  border-radius: var(--app-radius-lg)
  background: var(--app-card)
  box-shadow: 0 1px 2px rgba(16, 24, 40, .04)
  transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease
  font: inherit
  color: var(--app-text-primary)

  &--interactive
    cursor: pointer

    &:hover
      border-color: color-mix(in srgb, var(--tone) 45%, var(--app-border))
      box-shadow: 0 4px 14px rgba(16, 24, 40, .08)
      transform: translateY(-1px)

    &:focus-visible
      outline: 2px solid var(--tone)
      outline-offset: 2px

  &--active
    border-color: var(--tone)
    box-shadow: 0 0 0 1px var(--tone) inset

  &__icon
    display: flex
    align-items: center
    justify-content: center
    width: 40px
    height: 40px
    min-width: 40px
    border-radius: var(--app-radius)
    background: color-mix(in srgb, var(--tone) 12%, transparent)
    color: var(--tone)

  &__body
    display: flex
    flex-direction: column
    min-width: 0
    flex: 1

  &__label
    font-size: 12px
    font-weight: 600
    letter-spacing: .2px
    color: var(--app-text-secondary)
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  &__value
    font-size: 22px
    font-weight: 700
    line-height: 1.2
    font-variant-numeric: tabular-nums
    color: var(--app-text-primary)

  &__hint
    font-size: 11px
    color: var(--app-text-secondary)

  &__trend
    display: inline-flex
    align-items: center
    gap: 2px
    align-self: flex-start
    font-size: 11px
    font-weight: 700
    padding: 2px 7px
    border-radius: 999px
    background: color-mix(in srgb, var(--app-text-secondary) 12%, transparent)
    color: var(--app-text-secondary)

    &.is-up
      background: color-mix(in srgb, var(--app-positive) 14%, transparent)
      color: var(--app-positive)

    &.is-down
      background: color-mix(in srgb, var(--app-negative) 14%, transparent)
      color: var(--app-negative)

  &__filter-mark
    align-self: flex-start
    color: var(--tone)

// Tone per semantic colour — the icon tile, active ring and hover all read it.
.stat-tile--primary
  --tone: var(--q-primary)
.stat-tile--secondary
  --tone: var(--q-secondary)
.stat-tile--positive
  --tone: var(--app-positive)
.stat-tile--negative
  --tone: var(--app-negative)
.stat-tile--warning
  --tone: #B7791F
.stat-tile--info
  --tone: var(--q-secondary)
.stat-tile--grey-7
  --tone: var(--app-text-secondary)
</style>

<template>
  <q-btn
    v-bind="$attrs"
    class="app-btn"
    :class="[`app-btn--${variant}`, { 'app-btn--icon-only': !resolvedLabel }]"
    :color="quasarColor"
    :text-color="textColor"
    :outline="variant === 'secondary'"
    :flat="variant === 'ghost'"
    :unelevated="variant !== 'ghost' && variant !== 'secondary'"
    no-caps
    :dense="dense"
    :icon="icon || undefined"
    :label="resolvedLabel || undefined"
    :loading="loading"
    :disable="disable"
    :aria-label="ariaLabel || label || undefined"
  >
    <q-tooltip v-if="!resolvedLabel && (tooltip || label)">{{ tooltip || label }}</q-tooltip>
    <slot />
  </q-btn>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * ActionButton — the single button voice of the application.
 * ---------------------------------------------------------------------------
 *
 * Four intents, chosen by MEANING rather than by colour:
 *
 *   primary    Add · Create · Save · Submit
 *   secondary  Print · Export · Refresh · Back · Cancel (outlined)
 *   danger     Delete · Remove · Archive
 *   ghost      low-emphasis inline actions
 *
 * Every instance gets the same height, padding, radius, icon/label alignment,
 * hover lift and focus ring — so no page can invent its own button style. The
 * label collapses on narrow screens (`hideLabelOn`) while the tooltip and
 * aria-label keep the action fully described.
 */
import { computed } from 'vue'
import { useQuasar } from 'quasar'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  label: { type: String, default: '' },
  icon: { type: String, default: '' },
  /** 'primary' | 'secondary' | 'danger' | 'ghost' */
  variant: { type: String, default: 'secondary' },
  loading: { type: Boolean, default: false },
  disable: { type: Boolean, default: false },
  dense: { type: Boolean, default: true },
  tooltip: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  /** Hide the text label at or below this breakpoint ('xs' by default). */
  hideLabelOn: { type: String, default: 'xs' },
  /** Force an icon-only button regardless of screen size. */
  iconOnly: { type: Boolean, default: false },
})

const $q = useQuasar()

const quasarColor = computed(() => ({
  primary: 'primary',
  secondary: 'grey-8',
  danger: 'negative',
  ghost: 'grey-8',
}[props.variant] || 'primary'))

const textColor = computed(() => (props.variant === 'primary' || props.variant === 'danger' ? 'white' : undefined))

const resolvedLabel = computed(() => {
  if (props.iconOnly || !props.label) return ''
  const screen = $q.screen
  if (props.hideLabelOn === 'xs' && screen.lt.sm) return ''
  if (props.hideLabelOn === 'sm' && screen.lt.md) return ''
  return props.label
})
</script>

<style lang="sass">
.app-btn
  min-height: 34px
  padding: 0 14px
  border-radius: var(--app-radius)
  font-weight: 600
  letter-spacing: .2px
  transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease, transform .15s ease

  .q-icon
    font-size: 18px

  .q-btn__content
    gap: 6px
    flex-wrap: nowrap

  &--icon-only
    padding: 0 9px
    min-width: 34px

  &:hover:not([disabled])
    transform: translateY(-1px)

  &:active:not([disabled])
    transform: translateY(0)

  &:focus-visible
    outline: 2px solid var(--q-primary)
    outline-offset: 2px

  &--secondary
    border-color: var(--app-border)
    background: var(--app-card)

    &:hover:not([disabled])
      background: var(--app-hover)
      border-color: color-mix(in srgb, var(--q-primary) 40%, var(--app-border))
</style>

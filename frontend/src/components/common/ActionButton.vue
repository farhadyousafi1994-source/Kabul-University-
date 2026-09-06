<template>
  <q-btn
    v-bind="$attrs"
    class="app-btn ab-btn"
    :class="[
      `app-btn--${emphasis}`,
      `app-btn--intent-${intentToken}`,
      { 'app-btn--icon-only': !resolvedLabel },
    ]"
    flat
    no-caps
    :dense="dense"
    :icon="resolvedIcon || undefined"
    :label="resolvedLabel || undefined"
    :loading="loading"
    :disable="disable"
    :aria-label="ariaLabel || label || tooltip || undefined"
    :aria-busy="loading ? 'true' : undefined"
  >
    <q-tooltip v-if="!resolvedLabel && (tooltip || label)">{{ tooltip || label }}</q-tooltip>
    <template v-if="loading" #loading>
      <q-spinner-dots />
    </template>
    <slot />
  </q-btn>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * ActionButton — the single button voice of the application.
 * ---------------------------------------------------------------------------
 *
 * Buttons are declared by MEANING (`intent`), never by colour:
 *
 *   save · create · submit      brand primary, filled
 *   success · approve           green, filled
 *   excel · export              Excel green + spreadsheet icon  (always)
 *   pdf                         red-tinted
 *   edit                        blue
 *   view · details              cyan
 *   info · import               blue, tinted
 *   warning                     amber
 *   delete · danger · archive   red
 *   cancel · secondary · print  neutral grey, outlined
 *   ghost                       low-emphasis inline action
 *
 * The intent maps to a CSS token (`--app-action-*`) in
 * `src/config/actions.js`, so a theme change or a light/dark switch restyles
 * every button in the ERP at once — no colour is written in a page component.
 *
 * Shared by construction: height, padding, radius, typography, icon spacing,
 * hover lift, focus ring, disabled and loading states. The label collapses on
 * narrow screens (`hideLabelOn`) while the tooltip and aria-label keep the
 * action fully described for screen readers.
 *
 * The legacy `variant` prop ('primary' | 'secondary' | 'danger' | 'ghost')
 * still works and is mapped onto the matching intent.
 */
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { intentConfig, resolveIntent } from 'src/config/actions'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  label: { type: String, default: '' },
  icon: { type: String, default: '' },
  /** Semantic meaning of the action — see the list above. */
  intent: { type: String, default: '' },
  /** Legacy alias: 'primary' | 'secondary' | 'danger' | 'ghost'. */
  variant: { type: String, default: '' },
  /** Override the intent's default emphasis: 'solid' | 'soft' | 'quiet' | 'ghost'. */
  emphasis: { type: String, default: '' },
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

const intentName = computed(() => resolveIntent(props.intent || props.variant || 'secondary'))
const config = computed(() => intentConfig(intentName.value))
const intentToken = computed(() => config.value.token)
const emphasis = computed(() => props.emphasis || config.value.emphasis)
const resolvedIcon = computed(() => props.icon || config.value.icon)

const resolvedLabel = computed(() => {
  if (props.iconOnly || !props.label) return ''
  const screen = $q.screen
  if (props.hideLabelOn === 'xs' && screen.lt.sm) return ''
  if (props.hideLabelOn === 'sm' && screen.lt.md) return ''
  return props.label
})

defineExpose({ intent: intentName })
</script>

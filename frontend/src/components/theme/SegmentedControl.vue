<template>
  <q-btn-toggle
    :model-value="modelValue"
    :options="normalized"
    :color="color"
    :text-color="textColor"
    :toggle-color="toggleColor"
    :toggle-text-color="toggleTextColor"
    :dense="dense"
    :rounded="rounded"
    :no-caps="noCaps"
    :unelevated="unelevated"
    :outline="outline"
    :spread="spread"
    :disable="disable"
    class="seg no-wrap"
    role="radiogroup"
    :aria-label="ariaLabel || label"
    @update:model-value="onUpdate"
  />
</template>

<script setup>
/**
 * SegmentedControl — the compact "Icon + Label" toggle used by every
 * fine-tune setting on the Theme & Appearance page (display mode, font size,
 * corner radius, sidebar style, calendar, table density…).
 *
 * Thin wrapper over QBtnToggle so the whole page shares one visual language
 * and one accessibility contract (`role="radiogroup"`, dense sizing,
 * disabled state) instead of each card re-implementing it.
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  /** `[{ value, label, icon?, tooltip? }]` or a plain string array. */
  options: { type: Array, required: true },
  label: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  color: { type: String, default: 'grey-3' },
  textColor: { type: String, default: 'grey-9' },
  toggleColor: { type: String, default: 'primary' },
  toggleTextColor: { type: String, default: 'white' },
  dense: { type: Boolean, default: true },
  rounded: { type: Boolean, default: false },
  noCaps: { type: Boolean, default: true },
  unelevated: { type: Boolean, default: true },
  outline: { type: Boolean, default: false },
  spread: { type: Boolean, default: true },
  disable: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const normalized = computed(() =>
  props.options.map((option) => {
    if (typeof option === 'string') return { label: option, value: option, noCaps: true }
    return { noCaps: true, ...option }
  }),
)

function onUpdate(value) {
  emit('update:modelValue', value)
}
</script>

<style lang="sass" scoped>
.seg
  width: 100%
  border-radius: var(--app-radius)
  overflow: hidden
  box-shadow: var(--ku-shadow-sm)
  border: 1px solid var(--app-border)

  :deep(.q-btn)
    font-weight: 600
    letter-spacing: .1px
    min-height: 32px

  :deep(.q-btn--active)
    box-shadow: none
</style>

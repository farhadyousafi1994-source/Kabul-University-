<template>
  <div class="ctf" :class="{ 'ctf--invalid': invalid }">
    <q-btn
      flat
      dense
      class="ctf__swatch"
      :style="{ background: modelValue || 'transparent' }"
      :aria-label="`${label} colour picker`"
      :disable="disable"
      @click="openPicker"
    >
      <q-icon v-if="!modelValue" name="format_color_fill" size="14px" />
    </q-btn>

    <q-input
      :model-value="modelValue || ''"
      :label="label"
      :hint="hex ? hex.toUpperCase() : undefined"
      :error="invalid"
      :error-message="invalid ? invalidMessage : undefined"
      :disable="disable"
      dense
      outlined
      class="ctf__input"
      input-class="text-uppercase text-weight-medium"
      maxlength="7"
      :aria-label="label"
      @update:model-value="onInput"
      @blur="commit(draft)"
    >
      <template #append>
        <q-btn
          v-if="showReset && modelValue && modelValue !== schemeValue"
          flat
          dense
          round
          size="xs"
          icon="restart_alt"
          :aria-label="`Reset ${label}`"
          @click.stop="reset"
        >
          <q-tooltip>{{ resetLabel }}</q-tooltip>
        </q-btn>
      </template>
    </q-input>

    <q-popup-proxy v-model="pickerOpen" cover transition-show="scale" transition-hide="scale">
      <q-color
        :model-value="modelValue || '#000000'"
        :palette="palette"
        no-header-tabs
        default-view="palette"
        :square="false"
        :disable="disable"
        style="width: 260px"
        @update:model-value="commit"
      />
      <div class="row justify-end q-pa-sm q-gutter-sm" style="background: var(--app-card)">
        <q-btn flat dense no-caps :label="closeLabel" @click="pickerOpen = false" />
      </div>
    </q-popup-proxy>
  </div>
</template>

<script setup>
/**
 * ColorTokenField — one design token: a swatch that opens Quasar's QColor
 * picker, an editable HEX input with validation, and a reset button that
 * restores the token to the currently selected scheme.
 *
 * Dragging inside QColor fires on every pixel, so palette drags are committed
 * through the picker (immediate — CSS variable writes are cheap) while typed
 * hex values are only committed once they parse.
 */
import { computed, ref, watch } from 'vue'
import { isValidHex, normaliseHex } from 'src/config/themes'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  /** Value from the active preset — enables the reset button. */
  schemeValue: { type: String, default: '' },
  showReset: { type: Boolean, default: true },
  disable: { type: Boolean, default: false },
  resetLabel: { type: String, default: 'Reset to scheme' },
  closeLabel: { type: String, default: 'Close' },
  invalidMessage: { type: String, default: 'Enter a hex colour, e.g. #2E7D32' },
  palette: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'reset'])

const draft = ref(props.modelValue || '')
const pickerOpen = ref(false)

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value || ''
  },
)

const hex = computed(() => normaliseHex(draft.value))
const invalid = computed(() => Boolean(draft.value) && !isValidHex(draft.value))

function onInput(value) {
  draft.value = String(value || '').trim()
  if (isValidHex(draft.value)) commit(draft.value)
}

function commit(value) {
  const next = normaliseHex(value)
  if (next && next !== normaliseHex(props.modelValue)) emit('update:modelValue', next)
}

function reset() {
  pickerOpen.value = false
  emit('reset')
}

function openPicker() {
  if (props.disable) return
  pickerOpen.value = !pickerOpen.value
}
</script>

<style lang="sass" scoped>
.ctf
  display: flex
  align-items: flex-start
  gap: 8px

  &__swatch
    width: 34px
    height: 34px
    min-width: 34px
    margin-top: 2px
    border-radius: var(--app-radius)
    border: 1px solid var(--app-border)
    box-shadow: var(--ku-shadow-sm)
    color: var(--app-text-secondary)

    &:hover
      transform: none
      border-color: var(--app-primary)

  &__input
    flex: 1
    min-width: 0
</style>

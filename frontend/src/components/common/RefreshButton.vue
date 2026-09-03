<template>
  <ActionButton
    variant="secondary"
    icon="refresh"
    :label="t('common.refresh')"
    :tooltip="t('common.refreshTooltip')"
    :aria-label="t('common.refresh')"
    :loading="busy"
    :disable="busy"
    data-cy="refresh-btn"
    @click="run"
  />
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * RefreshButton — reload the page's data without reloading the page.
 * ---------------------------------------------------------------------------
 *
 * • Shows a loading state for as long as the handler is running.
 * • Guards against duplicate requests: clicking while busy is ignored.
 * • Never touches the page's filters, search term, sorting or pagination —
 *   the handler re-runs the SAME query, so the view the user built survives.
 * • Reports the outcome with a toast (silenceable for chatty pages).
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from './ActionButton.vue'
import { notify } from 'src/utils/notify'

const props = defineProps({
  /** Async function that reloads the page data (table + statistics + charts). */
  handler: { type: Function, default: null },
  /** External busy flag, for pages that already track their own loading. */
  loading: { type: Boolean, default: false },
  /** Suppress the success toast (error toasts are always shown). */
  silent: { type: Boolean, default: false },
})

const emit = defineEmits(['refresh'])

const { t } = useI18n()
const working = ref(false)
// An external `loading` (the page's own fetch) also disables the button, so a
// refresh can never overlap a load that is already in flight.
const busy = computed(() => working.value || props.loading)

async function run() {
  if (busy.value) return
  working.value = true
  try {
    emit('refresh')
    if (props.handler) await props.handler()
    if (!props.silent) notify.success(t('common.refreshed'))
  } catch (e) {
    notify.error(e?.message || t('common.refreshFailed'))
  } finally {
    working.value = false
  }
}
</script>

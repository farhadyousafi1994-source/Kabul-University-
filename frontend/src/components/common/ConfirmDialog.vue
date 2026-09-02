<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide">
    <q-card class="q-dialog-plugin ku-confirm" :style="cardStyle">
      <q-card-section class="row items-start no-wrap q-gutter-sm">
        <q-avatar :icon="icon" :color="tone" text-color="white" size="40px" class="ku-confirm__icon">
          <template v-if="busy"><q-spinner-hourglass size="20px" /></template>
        </q-avatar>
        <div class="col" style="min-width: 0">
          <div class="text-h6 ku-confirm__title">{{ title }}</div>
          <div v-if="message" class="text-body2 ku-confirm__message">{{ message }}</div>
          <div v-if="detail" class="text-caption text-grey-7 q-mt-xs">{{ detail }}</div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn
          flat
          no-caps
          :label="cancelLabel"
          color="grey-8"
          :disable="busy"
          data-cy="confirm-cancel"
          @click="onDialogCancel"
        />
        <q-btn
          unelevated
          no-caps
          :color="tone"
          :label="busy ? busyLabel : okLabel"
          :loading="busy"
          :icon="busy ? undefined : icon"
          data-cy="confirm-ok"
          @click="onConfirmClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
/**
 * Reusable confirmation dialog used by every destructive / state-changing
 * action in the application (Delete, Archive, Return, Reset, Restore…).
 *
 * Why a custom component instead of `Dialog.create({ title, message, ok })`?
 * Quasar's built-in plugin dialog closes the moment OK is clicked, so the
 * request would run *after* the dialog disappeared and a failure could not
 * keep it open. This component owns its OK button:
 *
 *   OK → spinner + disabled → await the API → SUCCESS → notify → close
 *                                          → ERROR   → notify → stay open
 *
 * It is driven through the Dialog plugin (`useDialogPluginComponent`) so
 * callers keep the ergonomic `confirmAction({ … }).then(ok => …)` API.
 */
import { computed, ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { notify } from 'src/utils/notify'

defineEmits([...useDialogPluginComponent.emits])

const props = defineProps({
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  detail: { type: String, default: '' },
  okLabel: { type: String, default: 'Confirm' },
  busyLabel: { type: String, default: 'Working…' },
  cancelLabel: { type: String, default: 'Cancel' },
  icon: { type: String, default: 'help_outline' },
  color: { type: String, default: 'negative' },
  /** Optional async work to run before the dialog is allowed to close. */
  onConfirm: { type: Function, default: null },
  /** Error toast fallback when `onConfirm` rejects. */
  errorMessage: { type: String, default: '' },
  /** Called with the result of `onConfirm` right before the dialog closes. */
  onConfirmed: { type: Function, default: null },
  cardStyle: { type: String, default: 'min-width: 380px; max-width: 520px' },
})

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const busy = ref(false)
const tone = computed(() => props.color || 'primary')

async function onConfirmClick() {
  if (busy.value) return // prevent duplicate submissions
  if (typeof props.onConfirm !== 'function') {
    onDialogOK(true)
    return
  }

  busy.value = true
  try {
    const result = await props.onConfirm()
    props.onConfirmed?.(result)
    onDialogOK(result === undefined ? true : result)
  } catch (err) {
    // Backend rejected: keep the dialog open, preserve context, tell the user.
    notify.apiError(err, props.errorMessage ? { fallback: props.errorMessage } : {})
  } finally {
    busy.value = false
  }
}
</script>

<style lang="sass">
.ku-confirm
  border-radius: var(--ku-radius-card)

  &__icon
    box-shadow: var(--ku-shadow-sm)

  &__title
    line-height: 1.25

  &__message
    color: var(--ku-ink-soft)
    margin-top: 2px
    line-height: 1.5
</style>

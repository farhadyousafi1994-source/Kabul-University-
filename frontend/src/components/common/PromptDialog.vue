<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide">
    <q-card class="q-dialog-plugin ku-prompt" :style="cardStyle">
      <q-card-section class="row items-start no-wrap q-gutter-sm q-pb-none">
        <q-avatar :icon="icon" :color="tone" text-color="white" size="40px" class="ku-prompt__icon">
          <template v-if="busy"><q-spinner-hourglass size="20px" /></template>
        </q-avatar>
        <div class="col" style="min-width: 0">
          <div class="text-h6 ku-prompt__title">{{ title }}</div>
          <div v-if="message" class="text-body2 ku-prompt__message">{{ message }}</div>
        </div>
        <q-btn flat round dense icon="close" :disable="busy" :aria-label="cancelLabel" @click="onDialogCancel" />
      </q-card-section>

      <q-card-section>
        <q-form ref="formRef" class="column q-gutter-md" @submit.prevent="onConfirmClick">
          <template v-for="field in normalizedFields" :key="field.name">
            <!-- select / radio -->
            <q-select
              v-if="field.type === 'select'"
              v-model="values[field.name]"
              :label="field.label"
              :options="field.options || []"
              :hint="field.hint"
              :placeholder="field.placeholder"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :disable="busy"
              :rules="rulesFor(field)"
              :error="Boolean(errors[field.name])"
              :error-message="errors[field.name]"
              :data-cy="`prompt-${field.name}`"
            />

            <q-option-group
              v-else-if="field.type === 'radio'"
              v-model="values[field.name]"
              :options="field.options || []"
              type="radio"
              dense
              :disable="busy"
              :data-cy="`prompt-${field.name}`"
            />

            <!-- textarea -->
            <q-input
              v-else-if="field.type === 'textarea'"
              v-model="values[field.name]"
              :label="field.label"
              :hint="field.hint"
              :placeholder="field.placeholder"
              :maxlength="field.maxlength"
              :counter="Boolean(field.maxlength)"
              type="textarea"
              dense
              outlined
              autogrow
              :disable="busy"
              :rules="rulesFor(field)"
              :error="Boolean(errors[field.name])"
              :error-message="errors[field.name]"
              :data-cy="`prompt-${field.name}`"
            />

            <!-- everything else: text / number / date -->
            <q-input
              v-else
              v-model="values[field.name]"
              :label="field.label"
              :hint="field.hint"
              :placeholder="field.placeholder"
              :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              dense
              outlined
              :disable="busy"
              :rules="rulesFor(field)"
              :error="Boolean(errors[field.name])"
              :error-message="errors[field.name]"
              :data-cy="`prompt-${field.name}`"
            />
          </template>

          <q-card-actions align="right" class="q-gutter-sm q-pa-none">
            <q-btn
              flat
              no-caps
              :label="cancelLabel"
              color="grey-8"
              :disable="busy"
              data-cy="prompt-cancel"
              @click="onDialogCancel"
            />
            <q-btn
              type="submit"
              unelevated
              no-caps
              :color="tone"
              :label="busy ? busyLabel : okLabel"
              :loading="busy"
              :icon="busy ? undefined : icon"
              data-cy="prompt-ok"
            >
              <template #loading><q-spinner-dots class="q-mr-sm" />{{ busyLabel }}</template>
            </q-btn>
          </q-card-actions>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
/**
 * Reusable "ask for a few values, then do the work" dialog.
 *
 * It exists for the same reason as `ConfirmDialog`: Quasar's built-in
 * `Dialog.create({ prompt })` / `{ options }` closes the instant OK is clicked,
 * so the API call runs with no spinner and a failure cannot keep the dialog
 * open. This component owns its OK button:
 *
 *   OK → client validation → spinner + disabled → await the API
 *      → SUCCESS → resolve with the values → dialog closes
 *      → ERROR   → toast + inline field errors → dialog STAYS open, values kept
 *
 * Driven through the Dialog plugin, so callers get a promise-based API:
 *
 *   const res = await promptAction({
 *     title: 'Complete work order',
 *     fields: [
 *       { name: 'result', label: 'Result', type: 'textarea', required: true },
 *       { name: 'cost',   label: 'Cost',   type: 'number', value: 0 },
 *     ],
 *     onConfirm: (values) => maintenanceService.transition(row.id, values),
 *   })
 *   if (res.ok) await load()
 */
import { computed, reactive, ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { notify } from 'src/utils/notify'
import { normaliseError } from 'src/utils/apiError'

defineEmits([...useDialogPluginComponent.emits])

const props = defineProps({
  title: { type: String, default: 'Please confirm' },
  message: { type: String, default: '' },
  okLabel: { type: String, default: 'Confirm' },
  busyLabel: { type: String, default: 'Working…' },
  cancelLabel: { type: String, default: 'Cancel' },
  icon: { type: String, default: 'edit' },
  color: { type: String, default: 'primary' },
  /** Field definitions — see the header comment for the shape. */
  fields: { type: Array, default: () => [] },
  /** `values => Promise` — the request that must succeed before we close. */
  onConfirm: { type: Function, default: null },
  /** Called with the API result right before the dialog closes. */
  onConfirmed: { type: Function, default: null },
  errorMessage: { type: String, default: '' },
  requiredMessage: { type: String, default: 'This field is required.' },
  cardStyle: { type: String, default: 'min-width: 400px; max-width: 560px' },
})

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const formRef = ref(null)
const busy = ref(false)
const tone = computed(() => props.color || 'primary')

const normalizedFields = computed(() =>
  (props.fields || []).map((f) => ({
    type: 'text',
    value: null,
    required: false,
    options: [],
    ...f,
  })),
)

const values = reactive({})
const errors = reactive({})
for (const field of normalizedFields.value) values[field.name] = field.value

function rulesFor(field) {
  const rules = []
  if (field.required) {
    rules.push((v) => (v !== null && v !== undefined && String(v).trim() !== '') || field.requiredMessage || props.requiredMessage)
  }
  if (typeof field.validate === 'function') rules.push(field.validate)
  return rules
}

function clearErrors() {
  for (const key of Object.keys(errors)) delete errors[key]
}

async function onConfirmClick() {
  if (busy.value) return // duplicate-submission guard

  clearErrors()
  const valid = formRef.value ? await formRef.value.validate() : true
  if (!valid) return

  const payload = {}
  for (const field of normalizedFields.value) {
    let value = values[field.name]
    if (field.type === 'number') value = value === '' || value === null ? null : Number(value)
    payload[field.name] = value
  }

  if (typeof props.onConfirm !== 'function') {
    onDialogOK(payload)
    return
  }

  busy.value = true
  try {
    const result = await props.onConfirm(payload)
    props.onConfirmed?.(result, payload)
    onDialogOK({ ...payload, __result: result })
  } catch (rawError) {
    // Backend rejected: keep the dialog open, keep what the user typed, and
    // surface both the general message and any per-field validation errors.
    const err = normaliseError(rawError)
    for (const [key, messages] of Object.entries(err.allFieldErrors || {})) {
      if (key in values && messages?.length) errors[key] = messages[0]
    }
    notify.apiError(err, props.errorMessage ? { fallback: props.errorMessage } : {})
  } finally {
    busy.value = false
  }
}
</script>

<style lang="sass">
.ku-prompt
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

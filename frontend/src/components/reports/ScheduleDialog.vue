<template>
  <q-dialog v-model="open" persistent>
    <q-card class="schedule-dialog app-card">
      <header class="app-card__header">
        <div>
          <h3 class="app-card__title">
            <q-icon name="schedule_send" size="20px" /> {{ t('reports.schedule.create') }}
          </h3>
          <p class="app-card__hint">{{ t('reports.schedule.hint') }}</p>
        </div>
      </header>

      <div class="app-card__body schedule-dialog__body">
        <q-select
          v-model="form.saved_report_id"
          :options="reportOptions"
          :label="t('reports.saved.title')"
          outlined
          dense
          emit-value
          map-options
          options-dense
          :error="showError"
          :error-message="t('reports.schedule.saveFirst')"
        />

        <div class="schedule-dialog__grid">
          <q-select
            v-model="form.frequency"
            :options="frequencyOptions"
            :label="t('reports.schedule.frequency')"
            outlined
            dense
            emit-value
            map-options
            options-dense
          />

          <q-select
            v-if="form.frequency === 'weekly'"
            v-model.number="form.day_of_week"
            :options="dayOptions"
            :label="t('reports.schedule.dayOfWeek')"
            outlined
            dense
            emit-value
            map-options
            options-dense
          />

          <q-input
            v-if="form.frequency === 'monthly' || form.frequency === 'quarterly'"
            v-model.number="form.day_of_month"
            type="number"
            :min="1"
            :max="28"
            outlined
            dense
            :label="t('reports.schedule.dayOfMonth')"
          />

          <q-input
            v-model="form.time_of_day"
            type="time"
            outlined
            dense
            stack-label
            :label="t('reports.schedule.time')"
          />

          <q-select
            v-model="form.delivery"
            :options="deliveryOptions"
            :label="t('reports.schedule.delivery')"
            outlined
            dense
            emit-value
            map-options
            options-dense
          />

          <q-select
            v-model="form.format"
            :options="formatOptions"
            :label="t('reports.schedule.format')"
            outlined
            dense
            emit-value
            map-options
            options-dense
          />
        </div>

        <q-input
          v-if="form.delivery === 'email'"
          v-model="form.recipients"
          outlined
          dense
          :label="t('reports.schedule.recipients')"
          :hint="t('reports.schedule.recipientsHint')"
        />
      </div>

      <footer class="schedule-dialog__footer">
        <ActionButton intent="cancel" :label="t('reports.actions.cancel')" hide-label-on="none" @click="open = false" />
        <ActionButton
          intent="submit"
          icon="event_available"
          :label="t('reports.actions.schedule')"
          hide-label-on="none"
          :loading="busy"
          @click="submit"
        />
      </footer>
    </q-card>
  </q-dialog>
</template>

<script setup>
/**
 * Schedule an existing saved report — daily, weekly, monthly or quarterly —
 * delivered as a system notification, an email or to the download centre.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  savedReports: { type: Array, default: () => [] },
  /** Existing schedule when editing. */
  schedule: { type: Object, default: null },
  /** Pre-selected saved report id. */
  reportId: { type: [Number, String], default: null },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const { t } = useI18n()
const showError = ref(false)

const form = reactive({
  saved_report_id: null,
  frequency: 'weekly',
  day_of_week: 1,
  day_of_month: 1,
  time_of_day: '08:00',
  delivery: 'notification',
  recipients: '',
  format: 'pdf',
})

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const reportOptions = computed(() => props.savedReports.map((report) => ({ value: report.id, label: report.name })))

const frequencyOptions = computed(() =>
  ['daily', 'weekly', 'monthly', 'quarterly'].map((value) => ({ value, label: t(`reports.schedule.${value}`) })),
)
const deliveryOptions = computed(() => [
  { value: 'notification', label: t('reports.schedule.notification') },
  { value: 'email', label: t('reports.schedule.email') },
  { value: 'download', label: t('reports.schedule.downloadCenter') },
])
const formatOptions = computed(() => [
  { value: 'pdf', label: t('reports.actions.exportPdf') },
  { value: 'excel', label: t('reports.actions.exportExcel') },
  { value: 'csv', label: t('reports.actions.exportCsv') },
])
const dayOptions = computed(() =>
  [0, 1, 2, 3, 4, 5, 6].map((value) => ({ value, label: t(`reports.schedule.days.${value}`) })),
)

watch(
  () => [props.modelValue, props.schedule, props.reportId],
  () => {
    if (!props.modelValue) return
    showError.value = false
    const source = props.schedule
    form.saved_report_id = source?.saved_report_id ?? props.reportId ?? props.savedReports[0]?.id ?? null
    form.frequency = source?.frequency || 'weekly'
    form.day_of_week = source?.day_of_week ?? 1
    form.day_of_month = source?.day_of_month ?? 1
    form.time_of_day = source?.time_of_day || '08:00'
    form.delivery = source?.delivery || 'notification'
    form.recipients = source?.recipients || ''
    form.format = source?.format || 'pdf'
  },
  { immediate: true },
)

function submit() {
  if (!form.saved_report_id) {
    showError.value = true
    return
  }
  emit('submit', { ...form })
}
</script>

<style scoped>
.schedule-dialog {
  inline-size: 560px;
  max-inline-size: 94vw;
}

.schedule-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-dialog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.schedule-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
}
</style>

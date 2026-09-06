<template>
  <q-dialog v-model="open" persistent>
    <q-card class="save-report-dialog app-card">
      <header class="app-card__header">
        <div>
          <h3 class="app-card__title">
            <q-icon name="bookmark_add" size="20px" /> {{ t('reports.saved.saveTitle') }}
          </h3>
          <p class="app-card__hint">{{ t('reports.saved.saveHint') }}</p>
        </div>
      </header>

      <div class="app-card__body save-report-dialog__body">
        <q-input
          v-model="form.name"
          outlined
          dense
          autofocus
          :label="t('reports.saved.name')"
          :error="showError"
          :error-message="t('reports.saved.nameRequired')"
          maxlength="120"
          counter
        />
        <q-input
          v-model="form.description"
          outlined
          dense
          type="textarea"
          autogrow
          :label="t('reports.saved.description')"
          maxlength="500"
        />
        <q-input
          v-model="form.question"
          outlined
          dense
          readonly
          :label="t('reports.saved.question')"
          :hint="questionHint"
        />
        <q-toggle v-model="form.is_shared" :label="t('reports.saved.shareWithTeam')" />
      </div>

      <footer class="save-report-dialog__footer">
        <ActionButton intent="cancel" :label="t('reports.actions.cancel')" hide-label-on="none" @click="open = false" />
        <ActionButton
          intent="save"
          icon="save"
          :label="t('reports.actions.save')"
          hide-label-on="none"
          :loading="busy"
          @click="submit"
        />
      </footer>
    </q-card>
  </q-dialog>
</template>

<script setup>
/** Name, describe and share a generated report so it can be re-run later. */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  /** Existing saved report when editing, otherwise null. */
  report: { type: Object, default: null },
  /** The natural-language question behind the current result. */
  question: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const { t } = useI18n()
const showError = ref(false)

const form = reactive({ name: '', description: '', question: '', is_shared: false })

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const questionHint = computed(() => (form.question ? '' : t('reports.saved.questionHint')))

watch(
  () => [props.modelValue, props.report],
  () => {
    if (!props.modelValue) return
    showError.value = false
    form.name = props.report?.name || ''
    form.description = props.report?.description || ''
    form.question = props.report?.question ?? props.question ?? ''
    form.is_shared = Boolean(props.report?.is_shared)
  },
  { immediate: true },
)

function submit() {
  if (!form.name.trim()) {
    showError.value = true
    return
  }
  emit('submit', { ...form, name: form.name.trim() })
}
</script>

<style scoped>
.save-report-dialog {
  inline-size: 520px;
  max-inline-size: 94vw;
}

.save-report-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.save-report-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
}
</style>

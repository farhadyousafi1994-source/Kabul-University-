<template>
  <q-dialog v-model="open" persistent>
    <q-card class="clarify-dialog app-card">
      <header class="app-card__header">
        <h3 class="app-card__title">
          <q-icon name="help_outline" size="20px" /> {{ t('reports.clarify.title') }}
        </h3>
      </header>

      <div class="app-card__body">
        <p class="clarify-dialog__question">{{ questionText }}</p>

        <q-option-group
          v-model="choice"
          :options="options"
          type="radio"
          class="clarify-dialog__options"
        />
      </div>

      <footer class="clarify-dialog__footer">
        <ActionButton intent="cancel" :label="t('reports.clarify.skip')" hide-label-on="none" @click="skip" />
        <ActionButton
          intent="submit"
          icon="check"
          :label="t('reports.clarify.apply')"
          hide-label-on="none"
          :disable="!choice"
          @click="apply"
        />
      </footer>
    </q-card>
  </q-dialog>
</template>

<script setup>
/**
 * Asks the one question the report generator still needs — which data source,
 * which period, which metric or how to group — before anything is executed.
 *
 * The clarification itself is produced by the NLU as translation keys, so the
 * dialog stays fully multilingual without knowing anything about the domain.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** `{ id, questionKey, apply, options: [{ value, labelKey }] }` */
  clarification: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'apply', 'skip'])

const { t, te } = useI18n()
const choice = ref(null)

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const questionText = computed(() => {
  const key = props.clarification?.questionKey
  return key && te(key) ? t(key) : t('reports.clarify.title')
})

const options = computed(() =>
  (props.clarification?.options || []).map((option) => ({
    value: option.value,
    label: option.labelKey && te(option.labelKey) ? t(option.labelKey) : String(option.value),
  })),
)

// Pre-select the first option so "Continue" is always one click away.
watch(
  () => props.clarification,
  (value) => { choice.value = value?.options?.[0]?.value ?? null },
  { immediate: true },
)

function apply() {
  if (!choice.value) return
  emit('apply', choice.value)
  open.value = false
}

function skip() {
  emit('skip')
  open.value = false
}
</script>

<style scoped>
.clarify-dialog {
  inline-size: 460px;
  max-inline-size: 92vw;
}

.clarify-dialog__question {
  margin: 0 0 12px;
  font-size: 1.02rem;
  font-weight: 600;
}

.clarify-dialog__options :deep(.q-radio) { padding-block: 2px; }

.clarify-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
}
</style>

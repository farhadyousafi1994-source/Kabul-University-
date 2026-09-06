<template>
  <section class="app-card app-card--accent app-accent-cyan preview-card">
    <header class="app-card__header">
      <div>
        <h3 class="app-card__title">
          <q-icon name="fact_check" size="20px" /> {{ t('reports.preview.title') }}
        </h3>
        <p class="app-card__hint">{{ t('reports.preview.subtitle') }}</p>
      </div>
      <div v-if="confidence" class="preview-card__confidence">
        <span class="app-hint">{{ t('reports.ask.confidence') }}</span>
        <q-linear-progress
          :value="confidence"
          size="8px"
          rounded
          :color="confidenceColor"
          class="preview-card__meter"
        />
        <span class="app-numeric">{{ confidencePercent }}</span>
      </div>
    </header>

    <div class="app-card__body">
      <p v-if="question" class="preview-card__question">
        <q-icon name="format_quote" size="16px" />
        <span>{{ question }}</span>
      </p>

      <dl class="preview-card__grid">
        <template v-for="(line, index) in lines" :key="index">
          <dt class="app-label">{{ tr(line.labelKey) }}</dt>
          <dd>
            <!-- Single translated value (data source, period). -->
            <span v-if="line.valueKey" class="app-badge app-badge--info">{{ tr(line.valueKey) }}</span>

            <!-- A list of translated values (metrics, grouping, columns). -->
            <template v-else-if="line.valueKeys?.length">
              <span v-for="key in line.valueKeys" :key="key" class="app-badge app-badge--neutral">{{ tr(key) }}</span>
            </template>

            <!-- Filters: label, operator and the raw value the user asked for. -->
            <template v-else-if="line.values?.length">
              <span v-for="(entry, i) in line.values" :key="i" class="app-badge app-badge--primary">
                {{ tr(entry.labelKey) }}
                <em class="preview-card__op">{{ operatorLabel(entry.op) }}</em>
                {{ valueLabel(entry.value) }}
              </span>
            </template>

            <span v-else class="app-numeric">{{ formatNumber(line.value) }}</span>
          </dd>
        </template>

        <dt class="app-label">{{ t('reports.preview.chartType') }}</dt>
        <dd><span class="app-badge app-badge--view">{{ t(`reports.charts.${chart || 'auto'}`) }}</span></dd>
      </dl>
    </div>

    <footer class="preview-card__footer">
      <ActionButton
        intent="submit"
        icon="play_arrow"
        :label="t('reports.preview.generate')"
        hide-label-on="none"
        :loading="busy"
        data-cy="preview-generate"
        @click="$emit('generate')"
      />
      <ActionButton
        intent="edit"
        icon="tune"
        :label="t('reports.preview.edit')"
        :disable="busy"
        @click="$emit('edit')"
      />
      <ActionButton
        intent="cancel"
        :label="t('reports.preview.cancel')"
        :disable="busy"
        @click="$emit('cancel')"
      />
    </footer>
  </section>
</template>

<script setup>
/**
 * The "report request" preview — what the system understood, shown before a
 * single row is read. Period, filters, grouping, metrics, row limit and chart
 * are listed as translation keys produced by `describeQuery()`, so the card
 * re-renders in the new language the instant the locale changes.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'
import { digits, number as formatNumber, titleCase } from 'src/utils/format'

const props = defineProps({
  /** Output of `describeQuery(query, catalog)`. */
  lines: { type: Array, default: () => [] },
  question: { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  chart: { type: String, default: 'auto' },
  busy: { type: Boolean, default: false },
})
defineEmits(['generate', 'edit', 'cancel'])

const { t, te } = useI18n()

const tr = (key) => (key && te(key) ? t(key) : titleCase(String(key || '').split('.').pop() || ''))
const operatorLabel = (op) => (te(`reports.operators.${op}`) ? t(`reports.operators.${op}`) : op)
const valueLabel = (value) => digits(String(value ?? ''))

const confidencePercent = computed(() => digits(`${Math.round((props.confidence || 0) * 100)}%`))
const confidenceColor = computed(() => {
  if (props.confidence >= 0.75) return 'positive'
  if (props.confidence >= 0.5) return 'info'
  return 'warning'
})
</script>

<style scoped>
.preview-card__confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 190px;
}

.preview-card__meter { inline-size: 84px; }

.preview-card__question {
  display: flex;
  gap: 8px;
  margin: 0 0 14px;
  font-style: italic;
  color: var(--app-text-muted, #667085);
}

.preview-card__grid {
  display: grid;
  grid-template-columns: minmax(120px, max-content) 1fr;
  gap: 10px 18px;
  margin: 0;
  align-items: start;
}

.preview-card__grid dd {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}

.preview-card__op {
  opacity: 0.75;
  font-style: normal;
  margin-inline: 4px;
}

.preview-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 16px;
}

@media (max-width: 599px) {
  .preview-card__grid { grid-template-columns: 1fr; gap: 4px 0; }
  .preview-card__grid dd { margin-block-end: 8px; }
}
</style>

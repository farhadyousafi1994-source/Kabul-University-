<template>
  <section class="report-result">
    <!-- ----------------------------------------------------------- header -->
    <div class="app-card report-result__head">
      <header class="app-card__header">
        <div>
          <h3 class="app-card__title">
            <q-icon :name="moduleIcon" size="20px" /> {{ reportTitle }}
          </h3>
          <p class="app-card__hint report-result__meta">
            <span>{{ t('reports.result.generatedAt') }}: <strong>{{ generatedAt }}</strong></span>
            <span v-if="generatedBy">· {{ t('reports.result.generatedBy') }}: <strong>{{ generatedBy }}</strong></span>
            <span>· {{ t('reports.result.rowsShown', { shown: shownCount, total: totalCount }) }}</span>
            <span v-if="isAggregate">· {{ t('reports.insights.rowCount', { count: recordCount }) }}</span>
            <span v-if="result?.meta?.duration_ms !== undefined">
              · {{ t('reports.result.durationMs', { ms: durationMs }) }}
            </span>
          </p>
        </div>

        <div class="report-result__toolbar print-hide">
          <ActionButton
            intent="secondary"
            icon="refresh"
            :label="t('reports.actions.refresh')"
            :loading="busy"
            @click="$emit('refresh')"
          />
          <ActionButton
            v-if="canSave"
            intent="save"
            icon="bookmark_add"
            :label="t('reports.actions.saveReport')"
            @click="$emit('save')"
          />
          <ActionButton
            v-if="canSchedule"
            intent="info"
            icon="schedule_send"
            :label="t('reports.actions.schedule')"
            @click="$emit('schedule')"
          />
        </div>
      </header>

      <div v-if="canExport" class="app-card__body report-result__exports print-hide">
        <ExportActions
          :rows="exportData.rows"
          :columns="exportData.columns"
          :filename="reportTitle"
          :title="reportTitle"
          :meta="exportMeta"
          print-selector=".report-print-area"
        />
        <ActionButton
          intent="export"
          emphasis="soft"
          icon="description"
          :label="t('reports.actions.exportCsv')"
          :disable="!hasRows"
          @click="exportCsv"
        />
      </div>

      <div v-if="notices.length" class="app-card__body report-result__notices">
        <p v-for="notice in notices" :key="notice.text" class="app-small report-result__notice">
          <q-icon :name="notice.icon" size="16px" /> {{ notice.text }}
        </p>
      </div>
    </div>

    <!-- ------------------------------------------------- printable content -->
    <div class="report-print-area print-area">
      <!-- summary cards -->
      <div v-if="summaryCards.length" class="report-result__summary">
        <StatCard
          v-for="card in summaryCards"
          :key="card.key"
          :label="card.label"
          :value="card.value"
          :icon="card.icon"
          :color="card.color"
          :description="card.description"
        />
      </div>

      <!-- chart -->
      <div v-if="chart" class="app-card report-result__chart">
        <header class="app-card__header">
          <h3 class="app-card__title">
            <q-icon name="insights" size="18px" /> {{ t('reports.charts.title') }}
          </h3>
          <q-select
            v-model="chartChoice"
            :options="chartOptions"
            dense
            outlined
            emit-value
            map-options
            options-dense
            class="report-result__chart-select print-hide"
            :label="t('reports.builder.chart')"
          />
        </header>
        <div class="app-card__body">
          <!-- Keyed on locale + direction so ApexCharts fully re-renders
               translated labels and mirrored axes on a language switch. -->
          <apexchart
            :key="`${locale}-${isRtl}-${chart.type}-${result?.meta?.generated_at}`"
            :type="chart.type"
            :height="chart.height"
            :options="chart.options"
            :series="chart.series"
          />
        </div>
      </div>

      <!-- insights -->
      <div v-if="insightList.length" class="app-card app-card--accent app-accent-teal report-result__insights">
        <header class="app-card__header">
          <h3 class="app-card__title">
            <q-icon name="tips_and_updates" size="18px" /> {{ t('reports.insights.title') }}
          </h3>
        </header>
        <ul class="app-card__body report-result__insight-list">
          <li v-for="(insight, index) in insightList" :key="index" :class="`tone-${insight.tone}`">
            <q-icon :name="insight.icon" size="18px" />
            <span>{{ insight.text }}</span>
          </li>
        </ul>
      </div>

      <!-- table -->
      <div class="app-card report-result__table">
        <header class="app-card__header">
          <h3 class="app-card__title">
            <q-icon name="table_chart" size="18px" /> {{ t('reports.result.table') }}
          </h3>
          <q-input
            v-model="search"
            dense
            outlined
            clearable
            debounce="250"
            :placeholder="t('reports.actions.search')"
            class="report-result__search print-hide"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </header>

        <q-table
          class="data-table app-table"
          :rows="tableRows"
          :columns="columns"
          :filter="search"
          row-key="__rk"
          flat
          :dense="dense"
          :loading="busy"
          :rows-per-page-options="[10, 25, 50, 100, 0]"
          :pagination="pagination"
          :no-data-label="t('reports.result.empty')"
          :loading-label="t('reports.result.loading')"
          :rows-per-page-label="t('reports.result.rowsPerPage')"
          :pagination-label="paginationLabel"
          @update:pagination="pagination = $event"
        >
          <template #no-data>
            <div class="report-result__empty">
              <q-icon name="search_off" size="34px" />
              <p class="app-body">{{ t('reports.result.empty') }}</p>
              <p class="app-hint">{{ t('reports.result.emptyHint') }}</p>
            </div>
          </template>
        </q-table>
      </div>
    </div>
  </section>
</template>

<script setup>
/**
 * The generated report: summary cards, an auto-selected chart, key insights
 * and the data table — plus Print / PDF / Excel / CSV exports that carry the
 * report title, applied filters, period, generation date and author.
 *
 * The payload from the server holds *data and label keys only*; every visible
 * string is produced through `useReportFormat()`, so switching language
 * re-renders the whole result — table headers, chart axes, insights and
 * summary cards — without another request.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'
import ExportActions from 'src/components/common/ExportActions.vue'
import StatCard from 'src/components/common/StatCard.vue'
import { useReportFormat } from 'src/composables/useReportFormat'
import { useAuthStore } from 'src/stores/auth'
import { useThemeStore } from 'src/stores/theme'
import { date as formatDate, digits } from 'src/utils/format'
import { downloadCsv, exportFilename } from 'src/utils/export'
import { notify } from 'src/utils/notify'

const props = defineProps({
  /** Payload of POST /api/reports/query. */
  result: { type: Object, default: null },
  /** Chart override chosen by the user ('auto' | 'line' | 'bar' | …). */
  chartType: { type: String, default: 'auto' },
  busy: { type: Boolean, default: false },
  canExport: { type: Boolean, default: true },
  canSave: { type: Boolean, default: true },
  canSchedule: { type: Boolean, default: false },
  /** Question or saved-report name shown as the report title. */
  titleText: { type: String, default: '' },
})
const emit = defineEmits(['update:chartType', 'refresh', 'save', 'schedule'])

const { t, locale } = useI18n()
const auth = useAuthStore()
const theme = useThemeStore()
const {
  label, formatValue, tableColumns, chartConfig, insights, exportRows, exportColumns, periodLabel, isRtl,
} = useReportFormat()

const search = ref('')
const pagination = ref({ page: 1, rowsPerPage: 25, sortBy: null, descending: false })
const dense = computed(() => (theme.settings?.tableDensity || theme.settings?.density) === 'compact')

const chartChoice = computed({
  get: () => props.chartType,
  set: (value) => emit('update:chartType', value),
})

const chartOptions = computed(() =>
  ['auto', 'column', 'bar', 'line', 'area', 'donut', 'pie', 'table'].map((value) => ({
    value,
    label: t(`reports.charts.${value}`),
  })),
)

const moduleIcon = computed(() => (props.result?.meta?.mode === 'detail' ? 'list_alt' : 'insights'))

const reportTitle = computed(() => {
  if (props.titleText) return props.titleText
  const key = props.result?.meta?.moduleLabelKey
  return key ? `${label(key)} — ${t('reports.result.title')}` : t('reports.result.title')
})

const columns = computed(() => tableColumns(props.result?.columns || []))
// q-table needs a stable row key; report rows are anonymous aggregates.
const tableRows = computed(() => (props.result?.rows || []).map((row, index) => ({ ...row, __rk: index })))
const hasRows = computed(() => Boolean(props.result?.rows?.length))
const isAggregate = computed(() => props.result?.meta?.mode === 'aggregate')
const shownCount = computed(() => digits(props.result?.rows?.length ?? 0))
// In summary mode the server's total counts underlying records, not groups —
// the groups are what the table shows, the records are reported separately.
const totalCount = computed(() => digits(
  isAggregate.value ? (props.result?.rows?.length ?? 0) : (props.result?.meta?.total_rows ?? props.result?.rows?.length ?? 0),
))
const recordCount = computed(() => digits(props.result?.meta?.total_rows ?? 0))
const durationMs = computed(() => digits(props.result?.meta?.duration_ms ?? 0))
const generatedAt = computed(() => formatDate(props.result?.meta?.generated_at, true))
const generatedBy = computed(() => auth.user?.name || '')

const paginationLabel = (first, last, total) =>
  `${digits(first)}–${digits(last)} / ${digits(total)}`

/** Totals returned by the server, rendered as KPI cards. */
const summaryCards = computed(() => {
  const summary = props.result?.summary || []
  const palette = ['blue', 'teal', 'indigo', 'amber', 'green', 'purple']
  return summary.map((entry, index) => ({
    key: entry.id,
    label: label(entry.labelKey, entry.id),
    value: formatValue(entry.value, { type: entry.type, role: 'metric' }),
    icon: entry.type === 'currency' ? 'payments' : 'functions',
    color: palette[index % palette.length],
    description: t('reports.result.grandTotal'),
  }))
})

const chart = computed(() => (props.result ? chartConfig(props.result, props.chartType) : null))
const insightList = computed(() => (props.result ? insights(props.result) : []))

/** Contextual notices: truncation and permission scoping. */
const notices = computed(() => {
  const out = []
  if (props.result?.meta?.truncated) {
    out.push({ icon: 'content_cut', text: t('reports.result.truncated', { limit: digits(props.result.query?.limit ?? 0) }) })
  }
  if (props.result?.meta?.scoped) {
    out.push({ icon: 'shield', text: t('reports.result.scoped') })
  }
  return out
})

// ---------------------------------------------------------------- exports
const exportData = computed(() => ({
  rows: props.result ? exportRows(props.result) : [],
  columns: props.result ? exportColumns(props.result) : [],
}))

/** Report header written into every export file. */
const exportMeta = computed(() => {
  const query = props.result?.query
  if (!query) return []
  const rows = [
    { label: t('reports.preview.dataSource'), value: label(props.result.meta?.moduleLabelKey, query.module) },
    { label: t('reports.preview.period'), value: periodLabel(query.dateRange?.preset || query.filters?.date_range?.preset) },
    { label: t('reports.result.generatedAt'), value: generatedAt.value },
    { label: t('reports.result.generatedBy'), value: generatedBy.value || '—' },
    { label: t('reports.result.table'), value: `${shownCount.value} / ${totalCount.value}` },
  ]
  const filters = Object.entries(query.filters || {}).filter(([key]) => key !== 'date_range')
  if (filters.length) {
    rows.push({
      label: t('reports.preview.filters'),
      value: filters
        .map(([key, spec]) => `${label(`reports.fields.${key}`, key)} ${t(`reports.operators.${spec.op}`)} ${
          Array.isArray(spec.value) ? spec.value.join(' – ') : spec.value}`)
        .join(' | '),
    })
  }
  for (const entry of props.result.summary || []) {
    rows.push({ label: label(entry.labelKey, entry.id), value: formatValue(entry.value, { type: entry.type, role: 'metric' }) })
  }
  return rows
})

function exportCsv() {
  if (!hasRows.value) {
    notify.warning(t('reports.errors.noData'))
    return
  }
  try {
    downloadCsv(exportFilename(reportTitle.value), exportData.value.rows, exportData.value.columns, { meta: exportMeta.value })
    notify.success(t('reports.notifications.exported'))
  } catch (error) {
    notify.error(error.message || t('reports.errors.exportFailed'))
  }
}

// A fresh result starts on page one; the search box keeps its value so a user
// refining the same report is not interrupted.
watch(() => props.result?.meta?.generated_at, () => { pagination.value = { ...pagination.value, page: 1 } })

// Keep the numeric summary readable when the numeral system changes.
watch(locale, () => { pagination.value = { ...pagination.value } })
</script>

<style scoped>
.report-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-result__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.report-result__toolbar,
.report-result__exports {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.report-result__exports :deep(.export-actions) {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.report-result__notices {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 0;
}

.report-result__notice {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--app-text-muted, #667085);
}

.report-result__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.report-result__chart,
.report-result__insights,
.report-result__table {
  margin-bottom: 16px;
}

.report-result__chart-select { min-inline-size: 170px; }
.report-result__search { min-inline-size: 220px; }

.report-result__insight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.report-result__insight-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1.55;
}

.tone-success { color: var(--app-action-success, #15803D); }
.tone-warning { color: var(--app-action-warning, #B45309); }
.tone-danger { color: var(--app-action-danger, #B42318); }
.tone-info { color: var(--app-action-info, #1D4ED8); }
.tone-neutral { color: var(--app-text, inherit); }

.report-result__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 34px 16px;
  color: var(--app-text-muted, #667085);
}

.report-result__empty p { margin: 0; }
</style>

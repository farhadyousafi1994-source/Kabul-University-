<template>
  <section class="app-card report-builder">
    <header class="app-card__header">
      <div>
        <h3 class="app-card__title">
          <q-icon name="build_circle" size="20px" /> {{ t('reports.builder.title') }}
        </h3>
        <p class="app-card__hint">{{ t('reports.builder.hint') }}</p>
      </div>
    </header>

    <div class="app-card__body report-builder__body">
      <!-- ------------------------------------------------- data source -->
      <div class="report-builder__grid">
        <q-select
          v-model="draft.module"
          :options="moduleOptions"
          :label="t('reports.builder.dataSource')"
          outlined
          dense
          emit-value
          map-options
          options-dense
          data-cy="builder-module"
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section avatar><q-icon :name="scope.opt.icon" /></q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>{{ scope.opt.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-select
          v-model="draft.mode"
          :options="modeOptions"
          :label="t('reports.builder.mode')"
          outlined
          dense
          emit-value
          map-options
          options-dense
        />

        <q-select
          v-model="draft.dateField"
          :options="dateOptions"
          :label="t('reports.builder.dateField')"
          outlined
          dense
          emit-value
          map-options
          options-dense
          :disable="!dateOptions.length"
        />

        <q-select
          v-model="draft.period"
          :options="periodOptions"
          :label="t('reports.builder.period')"
          outlined
          dense
          emit-value
          map-options
          options-dense
        />

        <q-input
          v-if="draft.period === 'custom'"
          v-model="draft.from"
          type="date"
          outlined
          dense
          stack-label
          :label="t('reports.filters.startDate')"
        />
        <q-input
          v-if="draft.period === 'custom'"
          v-model="draft.to"
          type="date"
          outlined
          dense
          stack-label
          :label="t('reports.filters.endDate')"
        />
      </div>

      <!-- ------------------------------------ metrics / columns / groups -->
      <div class="report-builder__grid">
        <q-select
          v-if="draft.mode === 'aggregate'"
          v-model="draft.metrics"
          :options="metricOptions"
          :label="t('reports.builder.metrics')"
          outlined
          dense
          multiple
          use-chips
          emit-value
          map-options
          options-dense
          :error="showMetricError"
          :error-message="t('reports.builder.noMetrics')"
          data-cy="builder-metrics"
        />
        <q-select
          v-else
          v-model="draft.fields"
          :options="fieldOptions"
          :label="t('reports.builder.fields')"
          outlined
          dense
          multiple
          use-chips
          emit-value
          map-options
          options-dense
        />

        <q-select
          v-if="draft.mode === 'aggregate'"
          v-model="draft.dimensions"
          :options="dimensionOptions"
          :label="t('reports.builder.groupBy')"
          outlined
          dense
          multiple
          use-chips
          emit-value
          map-options
          options-dense
          :max-values="2"
          :hint="t('reports.builder.groupByHint')"
        />

        <q-select
          v-model="draft.sortField"
          :options="sortOptions"
          :label="t('reports.builder.sortField')"
          outlined
          dense
          clearable
          emit-value
          map-options
          options-dense
        />

        <q-select
          v-model="draft.sortDirection"
          :options="directionOptions"
          :label="t('reports.builder.direction')"
          outlined
          dense
          emit-value
          map-options
          options-dense
        />

        <q-input
          v-model.number="draft.limit"
          type="number"
          outlined
          dense
          :min="1"
          :max="maxLimit"
          :label="t('reports.builder.limit')"
        />

        <q-select
          v-model="draft.chart"
          :options="chartOptions"
          :label="t('reports.builder.chart')"
          outlined
          dense
          emit-value
          map-options
          options-dense
        />
      </div>

      <!-- ------------------------------------------------------ filters -->
      <div class="report-builder__filters">
        <div class="report-builder__filters-head">
          <h4 class="app-label">{{ t('reports.builder.filters') }}</h4>
          <ActionButton
            intent="info"
            emphasis="soft"
            icon="add"
            :label="t('reports.builder.addFilter')"
            :disable="!filterOptions.length"
            @click="addFilter"
          />
        </div>

        <p v-if="!rows.length" class="app-hint">{{ t('reports.filters.none') }}</p>

        <div v-for="(row, index) in rows" :key="row.uid" class="report-builder__filter-row">
          <q-select
            v-model="row.field"
            :options="filterOptions"
            :label="t('reports.builder.field')"
            outlined
            dense
            emit-value
            map-options
            options-dense
            class="report-builder__filter-field"
            @update:model-value="onFilterFieldChange(row)"
          />

          <q-select
            v-model="row.op"
            :options="operatorOptionsFor(row)"
            :label="t('reports.builder.operator')"
            outlined
            dense
            emit-value
            map-options
            options-dense
            class="report-builder__filter-op"
          />

          <!-- enum values -->
          <q-select
            v-if="valueKind(row) === 'enum'"
            v-model="row.value"
            :options="enumOptionsFor(row)"
            :label="t('reports.builder.value')"
            outlined
            dense
            emit-value
            map-options
            options-dense
            class="report-builder__filter-value"
          />
          <!-- catalog lookups (categories, suppliers, departments, …) -->
          <q-select
            v-else-if="valueKind(row) === 'lookup'"
            v-model="row.value"
            :options="lookupOptionsFor(row)"
            :label="t('reports.builder.value')"
            outlined
            dense
            use-input
            input-debounce="120"
            new-value-mode="add-unique"
            options-dense
            class="report-builder__filter-value"
            @filter="(needle, done) => filterLookup(row, needle, done)"
          />
          <!-- dates / numbers / free text -->
          <template v-else-if="valueKind(row) !== 'none'">
            <q-input
              v-model="row.value"
              :type="inputTypeFor(row)"
              outlined
              dense
              :label="t('reports.builder.value')"
              class="report-builder__filter-value"
              stack-label
            />
            <q-input
              v-if="row.op === 'between'"
              v-model="row.value2"
              :type="inputTypeFor(row)"
              outlined
              dense
              :label="t('reports.builder.secondValue')"
              class="report-builder__filter-value"
              stack-label
            />
          </template>

          <ActionButton
            intent="delete"
            emphasis="quiet"
            icon="close"
            icon-only
            :tooltip="t('reports.builder.removeFilter')"
            :aria-label="t('reports.builder.removeFilter')"
            @click="removeFilter(index)"
          />
        </div>
      </div>
    </div>

    <footer class="report-builder__footer">
      <ActionButton
        intent="submit"
        icon="play_arrow"
        :label="t('reports.builder.run')"
        hide-label-on="none"
        :loading="busy"
        :disable="!canRun"
        data-cy="builder-run"
        @click="run"
      />
      <ActionButton intent="cancel" icon="restart_alt" :label="t('reports.builder.reset')" :disable="busy" @click="reset" />
      <q-space />
      <span class="app-hint report-builder__note">
        <q-icon name="lock" size="15px" /> {{ t('reports.security.readOnly') }}
      </span>
    </footer>
  </section>
</template>

<script setup>
/**
 * Advanced report builder — the non-conversational path to the very same
 * Report Query Object the "Ask your data" tab produces.
 *
 * Everything it offers comes from the server catalog: data sources, metrics,
 * groupings, filterable fields and the operators each field type allows. The
 * builder can therefore never construct a query the backend would reject, and
 * it gains new data sources the moment the catalog does — with no code change
 * and no new translations beyond the label keys the catalog references.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'
import { useReportCatalog } from 'src/composables/useReportCatalog'
import { useReportFormat } from 'src/composables/useReportFormat'

const props = defineProps({
  catalog: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  /** Load an existing query into the builder (from a question or saved report). */
  initialQuery: { type: Object, default: null },
})
const emit = defineEmits(['run'])

const { t, te } = useI18n()
const { label, enumLabel } = useReportFormat()
const { lookups, loadLookup } = useReportCatalog()

let uid = 0
const rows = ref([])
const touched = ref(false)

const draft = reactive({
  module: '',
  mode: 'aggregate',
  dateField: '',
  period: 'this_year',
  from: '',
  to: '',
  metrics: [],
  dimensions: [],
  fields: [],
  sortField: null,
  sortDirection: 'desc',
  limit: 50,
  chart: 'auto',
})

const modules = computed(() => props.catalog?.modules || [])
const activeModule = computed(() => modules.value.find((m) => m.id === draft.module) || null)
const maxLimit = computed(() => props.catalog?.limits?.max || 1000)

// ------------------------------------------------------------- options
const moduleOptions = computed(() =>
  modules.value.map((mod) => ({
    value: mod.id,
    label: label(mod.labelKey, mod.id),
    description: mod.descriptionKey && te(mod.descriptionKey) ? t(mod.descriptionKey) : '',
    icon: mod.icon || 'dataset',
  })),
)

const modeOptions = computed(() => [
  { value: 'aggregate', label: t('reports.builder.aggregate') },
  { value: 'detail', label: t('reports.builder.detail') },
])

const directionOptions = computed(() => [
  { value: 'desc', label: t('reports.builder.desc') },
  { value: 'asc', label: t('reports.builder.asc') },
])

const chartOptions = computed(() =>
  ['auto', 'column', 'bar', 'line', 'area', 'donut', 'pie', 'table'].map((value) => ({
    value,
    label: t(`reports.charts.${value}`),
  })),
)

const periodOptions = computed(() =>
  (props.catalog?.datePresets || []).map((preset) => ({
    value: preset,
    label: te(`reports.periods.${camel(preset)}`) ? t(`reports.periods.${camel(preset)}`) : preset,
  })),
)

const listOptions = (list = []) => list.map((entry) => ({ value: entry.id, label: label(entry.labelKey, entry.id) }))

const metricOptions = computed(() => listOptions(activeModule.value?.metrics))
const dimensionOptions = computed(() => listOptions(activeModule.value?.dimensions))
const fieldOptions = computed(() => listOptions(activeModule.value?.fields))
const filterOptions = computed(() => listOptions(activeModule.value?.filters))
const dateOptions = computed(() => listOptions(activeModule.value?.dates))

/** Sorting may target anything the report actually returns. */
const sortOptions = computed(() =>
  draft.mode === 'aggregate'
    ? [...metricOptions.value, ...dimensionOptions.value.filter((o) => draft.dimensions.includes(o.value))]
    : fieldOptions.value.filter((o) => draft.fields.includes(o.value)),
)

// ------------------------------------------------------------- filters
const filterDef = (row) => (activeModule.value?.filters || []).find((f) => f.id === row.field) || null

const operatorOptionsFor = (row) => {
  const def = filterDef(row)
  const ops = def?.operators || props.catalog?.operators?.text || ['eq']
  return ops.map((op) => ({ value: op, label: te(`reports.operators.${op}`) ? t(`reports.operators.${op}`) : op }))
}

function valueKind(row) {
  if (row.op === 'is_empty' || row.op === 'is_not_empty') return 'none'
  const def = filterDef(row)
  if (!def) return 'text'
  if (def.options?.length) return 'enum'
  if (def.lookup) return 'lookup'
  return def.type === 'date' ? 'date' : def.type === 'number' || def.type === 'currency' ? 'number' : 'text'
}

const inputTypeFor = (row) => {
  const kind = valueKind(row)
  return kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'
}

const enumOptionsFor = (row) => {
  const def = filterDef(row)
  return (def?.options || []).map((value) => ({ value, label: def.translate ? enumLabel(def.translate, value) : value }))
}

const lookupOptionsFor = (row) => {
  const values = lookups[filterDef(row)?.lookup] || []
  const needle = String(row.__needle || '').toLowerCase()
  return (needle ? values.filter((value) => String(value).toLowerCase().includes(needle)) : values).slice(0, 200)
}

/** Type-ahead over the allowlisted lookup values the server exposes. */
function filterLookup(row, needle, done) {
  const def = filterDef(row)
  if (!def?.lookup) {
    done(() => {})
    return
  }
  loadLookup(def.lookup).then(() => done(() => { row.__needle = needle }))
}

function addFilter() {
  const first = activeModule.value?.filters?.[0]
  if (!first) return
  const row = reactive({ uid: ++uid, field: first.id, op: first.operators?.[0] || 'eq', value: null, value2: null })
  rows.value.push(row)
  onFilterFieldChange(row)
}

function removeFilter(index) {
  rows.value.splice(index, 1)
}

function onFilterFieldChange(row) {
  const def = filterDef(row)
  row.value = null
  row.value2 = null
  if (def && !(def.operators || []).includes(row.op)) row.op = def.operators?.[0] || 'eq'
  if (def?.lookup) loadLookup(def.lookup)
}

// ------------------------------------------------------- module defaults
function applyModuleDefaults(mod) {
  if (!mod) return
  const defaults = mod.defaults || {}
  draft.metrics = [...(defaults.metrics || [])].filter((id) => mod.metrics.some((m) => m.id === id))
  draft.dimensions = [...(defaults.dimensions || [])].filter((id) => mod.dimensions.some((d) => d.id === id))
  draft.fields = [...(defaults.fields || [])].filter((id) => mod.fields.some((f) => f.id === id))
  draft.chart = defaults.chart || 'auto'
  draft.dateField = mod.defaultDate || mod.dates?.[0]?.id || ''
  draft.sortField = draft.metrics[0] || null
  rows.value = []
}

watch(() => draft.module, (id) => {
  const mod = modules.value.find((m) => m.id === id)
  if (mod) applyModuleDefaults(mod)
})

// Seed the builder: an explicit query wins, otherwise the first data source.
watch(
  () => [props.catalog, props.initialQuery],
  () => {
    if (!modules.value.length) return
    if (props.initialQuery?.module && modules.value.some((m) => m.id === props.initialQuery.module)) {
      load(props.initialQuery)
    } else if (!draft.module) {
      draft.module = modules.value[0].id
    }
  },
  { immediate: true, deep: false },
)

/** Load a Report Query Object into the form. */
function load(query) {
  draft.module = query.module
  draft.mode = query.mode || 'aggregate'
  draft.metrics = [...(query.metrics || [])]
  draft.dimensions = [...(query.dimensions || [])]
  draft.fields = [...(query.fields || [])]
  draft.dateField = query.dateField || activeModule.value?.defaultDate || ''
  draft.limit = query.limit || 50
  draft.chart = query.chart || 'auto'
  draft.sortField = query.sort?.field || null
  draft.sortDirection = query.sort?.direction || 'desc'

  const range = query.filters?.date_range
  draft.period = range?.preset || 'all_time'
  draft.from = range?.from || ''
  draft.to = range?.to || ''

  rows.value = Object.entries(query.filters || {})
    .filter(([key]) => key !== 'date_range')
    .map(([field, spec]) => reactive({
      uid: ++uid,
      field,
      op: spec.op || 'eq',
      value: Array.isArray(spec.value) ? spec.value[0] : spec.value,
      value2: Array.isArray(spec.value) ? spec.value[1] : null,
    }))
}

// --------------------------------------------------------------- output
/** Assemble the structured query — no SQL, only ids the catalog knows. */
function buildQuery() {
  const filters = {}
  for (const row of rows.value) {
    if (!row.field) continue
    const kind = valueKind(row)
    if (kind === 'none') {
      filters[row.field] = { op: row.op }
      continue
    }
    if (row.value === null || row.value === '') continue
    filters[row.field] = {
      op: row.op,
      value: row.op === 'between' ? [row.value, row.value2] : row.value,
    }
  }

  filters.date_range = draft.period === 'custom'
    ? { preset: 'custom', from: draft.from || null, to: draft.to || null }
    : { preset: draft.period }

  return {
    module: draft.module,
    mode: draft.mode,
    metrics: draft.mode === 'aggregate' ? [...draft.metrics] : [],
    dimensions: draft.mode === 'aggregate' ? [...draft.dimensions] : [],
    fields: draft.mode === 'detail' ? [...draft.fields] : [],
    dateField: draft.dateField || undefined,
    filters,
    sort: draft.sortField ? { field: draft.sortField, direction: draft.sortDirection } : null,
    limit: Math.min(Math.max(Number(draft.limit) || 50, 1), maxLimit.value),
    chart: draft.chart,
  }
}

const canRun = computed(() =>
  Boolean(draft.module) && (draft.mode === 'detail' ? draft.fields.length > 0 : draft.metrics.length > 0),
)
const showMetricError = computed(() => touched.value && draft.mode === 'aggregate' && !draft.metrics.length)

function run() {
  touched.value = true
  if (!canRun.value) return
  emit('run', buildQuery())
}

function reset() {
  touched.value = false
  applyModuleDefaults(activeModule.value)
  draft.period = 'this_year'
  draft.limit = 50
}

const camel = (snake) => String(snake).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

defineExpose({ load, buildQuery })
</script>

<style scoped>
.report-builder__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.report-builder__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.report-builder__filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-block-start: 6px;
  border-block-start: 1px solid var(--app-border, #E4E7EC);
}

.report-builder__filters-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-builder__filters-head h4 { margin: 0; }

.report-builder__filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.report-builder__filter-field { flex: 1 1 190px; }
.report-builder__filter-op { flex: 0 1 170px; }
.report-builder__filter-value { flex: 1 1 190px; }

.report-builder__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 0 16px 16px;
}

.report-builder__note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>

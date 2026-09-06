<template>
  <div class="standard-reports">
    <section class="app-card">
      <header class="app-card__header">
        <div>
          <h3 class="app-card__title">
            <q-icon name="description" size="20px" /> {{ t('reports.standard.title') }}
          </h3>
          <p class="app-card__hint">{{ t('reports.standard.hint') }}</p>
        </div>
        <ActionButton
          intent="secondary"
          icon="refresh"
          :label="t('reports.actions.refresh')"
          :loading="loading"
          @click="loadList"
        />
      </header>

      <div class="app-card__body">
        <div v-if="loading" class="standard-reports__grid">
          <q-skeleton v-for="n in 6" :key="n" type="rect" height="74px" />
        </div>
        <ErrorState v-else-if="error" :message="error" @retry="loadList" />
        <div v-else class="standard-reports__grid">
          <button
            v-for="report in reports"
            :key="report.name"
            type="button"
            :class="['standard-reports__card', { 'standard-reports__card--active': current === report.name }]"
            @click="open(report.name)"
          >
            <span class="app-icon-tile app-icon-tile--sm"><q-icon name="summarize" size="18px" /></span>
            <span class="standard-reports__card-text">
              <span class="app-card-title">{{ reportTitle(report) }}</span>
              <span class="app-hint">{{ reportDescription(report) }}</span>
            </span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="current" class="app-card standard-reports__result">
      <header class="app-card__header">
        <h3 class="app-card__title">{{ currentTitle }}</h3>
        <div class="standard-reports__toolbar print-hide">
          <ExportActions
            :rows="rows"
            :columns="columns"
            :filename="currentTitle"
            :title="currentTitle"
            :meta="exportMeta"
            print-selector=".standard-print-area"
          />
          <ActionButton
            intent="export"
            emphasis="soft"
            icon="file_download"
            :label="t('reports.actions.exportCsv')"
            :loading="exporting"
            :disable="!rows.length"
            @click="exportCsv"
          />
        </div>
      </header>

      <div class="app-card__body">
        <div v-if="rowsLoading">
          <q-skeleton type="rect" height="180px" />
        </div>
        <ErrorState v-else-if="rowsError" :message="rowsError" @retry="() => open(current)" />
        <div v-else class="standard-print-area print-area">
          <q-table
            class="data-table app-table"
            :rows="rows"
            :columns="columns"
            row-key="__rk"
            flat
            dense
            wrap-cells
            :pagination="pagination"
            :rows-per-page-options="[15, 30, 60, 0]"
            :no-data-label="t('reports.standard.noReportData')"
            @update:pagination="pagination = $event"
          >
            <template #no-data>
              <EmptyState icon="bar_chart" :title="t('common.noData')" :message="t('reports.standard.noReportData')" />
            </template>
          </q-table>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * The system's ready-made reports.
 *
 * Their titles, descriptions and column headers arrive from the API in
 * English; here they are matched against `reports.standardReports.*` and
 * `reports.fields.*` so the catalogue reads correctly in every language, and
 * fall back to the server text (title-cased) for any report added later.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionButton from 'src/components/common/ActionButton.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import ExportActions from 'src/components/common/ExportActions.vue'
import { reportService } from 'src/services/system.service'
import api from 'src/boot/axios'
import { date as formatDate, digits, titleCase } from 'src/utils/format'
import { stamp } from 'src/utils/export'
import { notify } from 'src/utils/notify'

const { t, te } = useI18n()

const reports = ref([])
const loading = ref(false)
const error = ref('')
const current = ref('')
const serverTitle = ref('')
const rawRows = ref([])
const rowsLoading = ref(false)
const rowsError = ref('')
const exporting = ref(false)
const pagination = ref({ page: 1, rowsPerPage: 15 })

const reportTitle = (report) => {
  const key = `reports.standardReports.${report.name}.title`
  return te(key) ? t(key) : report.title || titleCase(report.name.replace(/_/g, ' '))
}

const reportDescription = (report) => {
  const key = `reports.standardReports.${report.name}.description`
  return te(key) ? t(key) : report.description || ''
}

const currentTitle = computed(() => {
  const key = `reports.standardReports.${current.value}.title`
  return te(key) ? t(key) : serverTitle.value || titleCase(String(current.value).replace(/_/g, ' '))
})

/** Column labels: reuse the report vocabulary, fall back to the raw name. */
const columnLabel = (name) => {
  const key = `reports.fields.${name}`
  return te(key) ? t(key) : titleCase(name.replace(/_/g, ' '))
}

const rows = computed(() => rawRows.value.map((row, index) => ({ ...row, __rk: index })))

const columns = computed(() => {
  const first = rawRows.value[0]
  if (!first) return []
  return Object.keys(first).map((name) => ({
    name,
    field: name,
    label: columnLabel(name),
    align: 'left',
    sortable: true,
    format: (value) => (typeof value === 'number' ? digits(value) : value ?? '—'),
  }))
})

const exportMeta = computed(() => [
  { label: t('reports.result.generatedAt'), value: formatDate(new Date().toISOString(), true) },
  { label: t('reports.result.rowsShown'), value: digits(rawRows.value.length) },
])

async function loadList() {
  loading.value = true
  error.value = ''
  try {
    const response = await reportService.list()
    reports.value = response?.data?.data || []
  } catch (e) {
    error.value = e.message || t('reports.errors.loadFailed')
  } finally {
    loading.value = false
  }
}

async function open(name) {
  current.value = name
  rowsLoading.value = true
  rowsError.value = ''
  try {
    const response = await reportService.get(name)
    serverTitle.value = response?.data?.title || ''
    rawRows.value = response?.data?.rows || []
    pagination.value = { ...pagination.value, page: 1 }
  } catch (e) {
    rowsError.value = e.message || t('reports.errors.loadFailed')
    rawRows.value = []
  } finally {
    rowsLoading.value = false
  }
}

/**
 * Authenticated CSV download — the endpoint needs the bearer token, so the
 * blob is fetched through axios rather than opened in a new tab.
 */
async function exportCsv() {
  if (!current.value) return
  exporting.value = true
  try {
    const blob = await api.get(`/reports/${current.value}/export`, { responseType: 'blob' })
    if (blob?.type === 'application/json') {
      let message = t('reports.errors.exportFailed')
      try {
        message = JSON.parse(await blob.text())?.message || message
      } catch { /* keep the generic message */ }
      throw new Error(message)
    }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `report-${current.value}-${stamp()}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    notify.success(t('reports.notifications.exported'))
  } catch (e) {
    notify.error(e.message || t('reports.errors.exportFailed'))
  } finally {
    exporting.value = false
  }
}

onMounted(loadList)
</script>

<style scoped>
.standard-reports {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.standard-reports__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.standard-reports__card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--app-border, #E4E7EC);
  border-radius: var(--app-radius, 10px);
  background: var(--app-surface, #FFF);
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: border-color 0.16s ease, transform 0.16s ease, background-color 0.16s ease;
}

.standard-reports__card:hover {
  border-color: var(--app-accent, #2563EB);
  transform: translateY(-1px);
}

.standard-reports__card:focus-visible {
  outline: 2px solid var(--app-accent, #2563EB);
  outline-offset: 2px;
}

.standard-reports__card--active {
  border-color: var(--app-accent, #2563EB);
  background: color-mix(in srgb, var(--app-accent, #2563EB) 8%, transparent);
}

.standard-reports__card-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

.standard-reports__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.app-no-anim .standard-reports__card { transition: none; }
</style>

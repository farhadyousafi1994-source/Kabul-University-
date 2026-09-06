<template>
  <div class="page-container reports-page q-pa-md">
    <AppPageHeader
      :title="t('reports.title')"
      :subtitle="t('reports.subtitle')"
      icon="query_stats"
      :breadcrumbs="[{ label: t('nav.sections.administration') }, { label: t('reports.title') }]"
      :on-refresh="refreshAll"
      :refreshing="catalogLoading"
    />

    <!-- ------------------------------------------------------------ tabs -->
    <q-tabs
      v-model="tab"
      class="reports-page__tabs print-hide"
      align="left"
      no-caps
      inline-label
      dense
      :breakpoint="0"
    >
      <q-tab name="ask" icon="auto_awesome" :label="t('reports.tabs.ask')" />
      <q-tab name="builder" icon="build_circle" :label="t('reports.tabs.builder')" />
      <q-tab name="saved" icon="bookmarks" :label="t('reports.tabs.saved')" />
      <q-tab name="standard" icon="description" :label="t('reports.tabs.standard')" />
    </q-tabs>
    <q-separator class="print-hide" />

    <ErrorState v-if="catalogError" :message="catalogError" class="q-mt-md" @retry="refreshAll" />

    <q-tab-panels v-else v-model="tab" animated keep-alive class="reports-page__panels">
      <!-- =========================================================== ASK -->
      <q-tab-panel name="ask" class="reports-page__panel">
        <AskYourData
          v-model="question"
          :busy="running"
          :recent="history"
          @ask="onAsk"
          @clear-history="clearHistory"
        />

        <p v-if="parseWarning" class="app-small reports-page__warning">
          <q-icon name="info" size="16px" /> {{ parseWarning }}
        </p>

        <ReportPreviewCard
          v-if="showPreview"
          class="q-mt-md"
          :lines="previewLines"
          :question="activeQuestion"
          :confidence="confidence"
          :chart="draftQuery.chart"
          :busy="running"
          @generate="generate(draftQuery)"
          @edit="editInBuilder"
          @cancel="cancelDraft"
        />

        <ReportResult
          v-if="result"
          v-model:chart-type="chartType"
          class="q-mt-md"
          :result="result"
          :busy="running"
          :title-text="resultTitle"
          :can-export="permissions.export !== false"
          :can-save="true"
          :can-schedule="permissions.schedule === true"
          @refresh="regenerate"
          @save="openSaveDialog(null)"
          @schedule="scheduleCurrent"
        />
      </q-tab-panel>

      <!-- ======================================================= BUILDER -->
      <q-tab-panel name="builder" class="reports-page__panel">
        <ReportBuilder
          ref="builderRef"
          :catalog="catalog"
          :busy="running"
          :initial-query="builderSeed"
          @run="generate"
        />

        <ReportResult
          v-if="result && resultSource === 'builder'"
          v-model:chart-type="chartType"
          class="q-mt-md"
          :result="result"
          :busy="running"
          :title-text="resultTitle"
          :can-export="permissions.export !== false"
          :can-schedule="permissions.schedule === true"
          @refresh="regenerate"
          @save="openSaveDialog(null)"
          @schedule="scheduleCurrent"
        />
      </q-tab-panel>

      <!-- ========================================================= SAVED -->
      <q-tab-panel name="saved" class="reports-page__panel">
        <SavedReportsPanel
          :reports="savedReports"
          :schedules="schedules"
          :catalog="catalog"
          :busy="savedLoading"
          :running-id="runningSavedId"
          :can-schedule="permissions.schedule === true"
          @refresh="loadSaved"
          @run="runSaved"
          @edit="openSaveDialog"
          @duplicate="duplicateSaved"
          @remove="removeSaved"
          @share="toggleShare"
          @schedule="openScheduleDialog"
          @edit-schedule="openScheduleDialog($event, true)"
          @remove-schedule="removeSchedule"
          @toggle-schedule="toggleSchedule"
        />
      </q-tab-panel>

      <!-- ====================================================== STANDARD -->
      <q-tab-panel name="standard" class="reports-page__panel">
        <StandardReports />
      </q-tab-panel>
    </q-tab-panels>

    <!-- --------------------------------------------------------- dialogs -->
    <ReportClarifyDialog
      v-model="clarifyOpen"
      :clarification="activeClarification"
      @apply="applyClarify"
      @skip="skipClarify"
    />

    <SaveReportDialog
      v-model="saveOpen"
      :busy="savingReport"
      :report="editingReport"
      :question="activeQuestion"
      @submit="submitSave"
    />

    <ScheduleDialog
      v-model="scheduleOpen"
      :busy="savingSchedule"
      :saved-reports="savedReports"
      :schedule="editingSchedule"
      :report-id="scheduleReportId"
      @submit="submitSchedule"
    />
  </div>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * Reports — the Advanced AI-Powered Report Generator
 * ---------------------------------------------------------------------------
 *
 * Four ways to get to the same place:
 *
 *   Ask your data   a question in English, Farsi, Dari, Pashto or Arabic is
 *                   parsed offline into a structured Report Query Object
 *   Report builder  the same object assembled field by field
 *   Saved reports   stored queries, re-validated on every run, plus schedules
 *   Standard        the ready-made reports maintained by the system
 *
 * Security: the page never sends SQL. It sends `{ module, metrics, dimensions,
 * filters, sort, limit }` using ids the server catalog published for THIS
 * user; the server re-validates every id, applies branch/department scoping
 * and executes one read-only, parameterised statement.
 *
 * Multilingual by construction: the payload contains data and label keys only,
 * so a language switch re-renders titles, columns, charts, insights and
 * exports instantly — the state (question, filters, result) is untouched and
 * nothing is re-fetched.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import AskYourData from 'src/components/reports/AskYourData.vue'
import ReportBuilder from 'src/components/reports/ReportBuilder.vue'
import ReportClarifyDialog from 'src/components/reports/ReportClarifyDialog.vue'
import ReportPreviewCard from 'src/components/reports/ReportPreviewCard.vue'
import ReportResult from 'src/components/reports/ReportResult.vue'
import SaveReportDialog from 'src/components/reports/SaveReportDialog.vue'
import SavedReportsPanel from 'src/components/reports/SavedReportsPanel.vue'
import ScheduleDialog from 'src/components/reports/ScheduleDialog.vue'
import StandardReports from 'src/components/reports/StandardReports.vue'
import { useReportCatalog } from 'src/composables/useReportCatalog'
import { useReportFormat } from 'src/composables/useReportFormat'
import { reportGeneratorService } from 'src/services/reports.service'
import { applyClarification, describeQuery, parseQuestion } from 'src/utils/reportNlu'
import { confirmDelete } from 'src/utils/confirm'
import { notify } from 'src/utils/notify'

const HISTORY_KEY = 'ku_ams_report_history'
const HISTORY_LIMIT = 8

const { t, locale } = useI18n()
const { label } = useReportFormat()
const {
  catalog, loading: catalogLoading, error: catalogErrorRef, lookups,
  permissions, loadCatalog, loadAllLookups,
} = useReportCatalog()

// ------------------------------------------------------------------ state
const tab = ref('ask')
const question = ref('')
const activeQuestion = ref('')
const draftQuery = ref(null)
const confidence = ref(0)
const parseWarning = ref('')
const pendingClarifications = ref([])
const clarifyOpen = ref(false)
const running = ref(false)
const result = ref(null)
const resultSource = ref('ask')
const resultTitle = ref('')
const chartType = ref('auto')
const builderSeed = ref(null)
const builderRef = ref(null)
const history = ref(loadHistory())
const catalogError = ref('')

const savedReports = ref([])
const schedules = ref([])
const savedLoading = ref(false)
const runningSavedId = ref(null)

const saveOpen = ref(false)
const savingReport = ref(false)
const editingReport = ref(null)

const scheduleOpen = ref(false)
const savingSchedule = ref(false)
const editingSchedule = ref(null)
const scheduleReportId = ref(null)

const activeClarification = computed(() => pendingClarifications.value[0] || null)
// The request card only appears once every clarifying question is answered —
// a half-understood question is never presented as ready to run.
const showPreview = computed(() => Boolean(draftQuery.value) && !result.value && !pendingClarifications.value.length && !clarifyOpen.value)
const previewLines = computed(() => (draftQuery.value ? describeQuery(draftQuery.value, catalog.value) : []))

watch(catalogErrorRef, (value) => { if (value) catalogError.value = value })

// ------------------------------------------------------------- bootstrap
onMounted(async () => {
  try {
    await loadCatalog()
    catalogError.value = ''
    // Lookup values let the parser recognise "Dell", "Faculty of Science", …
    loadAllLookups()
  } catch (error) {
    catalogError.value = error?.message || t('reports.errors.catalogFailed')
  }
})

async function refreshAll() {
  try {
    await loadCatalog(true)
    catalogError.value = ''
    if (tab.value === 'saved') await loadSaved()
    if (result.value) await regenerate()
  } catch (error) {
    catalogError.value = error?.message || t('reports.errors.catalogFailed')
  }
}

watch(tab, (value) => {
  if (value === 'saved' && !savedReports.value.length && !savedLoading.value) loadSaved()
})

// -------------------------------------------------------------- ask flow
function onAsk(text) {
  activeQuestion.value = text
  parseWarning.value = ''
  result.value = null
  resultSource.value = 'ask'

  const parsed = parseQuestion(text, { catalog: catalog.value, lookups })

  if (parsed.unresolved && !parsed.clarifications?.length) {
    parseWarning.value = `${t('reports.ask.noMatch')} ${t('reports.ask.noMatchHint')}`
    draftQuery.value = null
    return
  }

  confidence.value = parsed.confidence
  draftQuery.value = parsed.query
  pendingClarifications.value = [...(parsed.clarifications || [])]

  if (pendingClarifications.value.length) {
    clarifyOpen.value = true
    return
  }
  preview(parsed.query)
}

function applyClarify(value) {
  const clarification = pendingClarifications.value.shift()
  if (!clarification) return

  // Answering "which data source" restarts the parse with the module known.
  if (clarification.id === 'module' && !draftQuery.value) {
    const parsed = parseQuestion(`${activeQuestion.value} ${value}`, { catalog: catalog.value, lookups })
    draftQuery.value = parsed.query || { module: value, mode: 'aggregate', metrics: [], dimensions: [], filters: {} }
    confidence.value = parsed.confidence
    pendingClarifications.value = [...(parsed.clarifications || [])]
  } else {
    draftQuery.value = applyClarification(draftQuery.value, clarification, value)
    confidence.value = Math.min(1, confidence.value + 0.1)
  }

  nextClarification()
}

function skipClarify() {
  pendingClarifications.value.shift()
  nextClarification()
}

function nextClarification() {
  if (pendingClarifications.value.length) {
    clarifyOpen.value = true
    return
  }
  clarifyOpen.value = false
  if (draftQuery.value) preview(draftQuery.value)
}

/** Ask the server to normalise + validate the query for the preview card. */
async function preview(query) {
  running.value = true
  try {
    const response = await reportGeneratorService.validate(query)
    draftQuery.value = response?.data?.query || query
    chartType.value = draftQuery.value.chart || 'auto'
  } catch (error) {
    draftQuery.value = query
    notify.error(error?.message || t('reports.errors.invalidQuery'))
  } finally {
    running.value = false
  }
}

function cancelDraft() {
  draftQuery.value = null
  parseWarning.value = ''
}

/** Send the current draft to the builder so the user can refine it. */
function editInBuilder() {
  builderSeed.value = { ...draftQuery.value }
  builderRef.value?.load?.(draftQuery.value)
  tab.value = 'builder'
}

// ----------------------------------------------------------- generation
async function generate(query, { source = tab.value, title = '' } = {}) {
  if (!query) return
  running.value = true
  try {
    const response = await reportGeneratorService.run(query)
    result.value = response?.data || null
    draftQuery.value = result.value?.query || query
    resultSource.value = source === 'builder' ? 'builder' : 'ask'
    resultTitle.value = title || activeQuestion.value || ''
    chartType.value = result.value?.query?.chart || 'auto'
    if (source !== 'builder' && activeQuestion.value) rememberQuestion(activeQuestion.value)
    notify.success(t('reports.notifications.generated'))
  } catch (error) {
    result.value = null
    notify.error(error?.message || t('reports.errors.generateFailed'))
  } finally {
    running.value = false
  }
}

function regenerate() {
  const query = result.value?.query || draftQuery.value
  if (query) generate(query, { source: resultSource.value, title: resultTitle.value })
}

// -------------------------------------------------------------- history
function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(raw) ? raw.slice(0, HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

function rememberQuestion(text) {
  const entry = { question: text, at: new Date().toISOString() }
  history.value = [entry, ...history.value.filter((item) => item.question !== text)].slice(0, HISTORY_LIMIT)
  persistHistory()
}

function clearHistory() {
  history.value = []
  persistHistory()
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch { /* storage full or unavailable — history is a convenience only */ }
}

// --------------------------------------------------------- saved reports
async function loadSaved() {
  savedLoading.value = true
  try {
    const [savedResponse, scheduleResponse] = await Promise.all([
      reportGeneratorService.saved.list(),
      permissions.value.schedule ? reportGeneratorService.schedules.list() : Promise.resolve({ data: { data: [] } }),
    ])
    savedReports.value = savedResponse?.data?.data || []
    schedules.value = scheduleResponse?.data?.data || []
  } catch (error) {
    notify.error(error?.message || t('reports.errors.loadFailed'))
  } finally {
    savedLoading.value = false
  }
}

function openSaveDialog(report) {
  editingReport.value = report || null
  saveOpen.value = true
}

async function submitSave(form) {
  const query = editingReport.value ? editingReport.value.query : (result.value?.query || draftQuery.value)
  if (!query) {
    notify.warning(t('reports.errors.noData'))
    return
  }

  savingReport.value = true
  try {
    const payload = {
      name: form.name,
      description: form.description,
      question: form.question || activeQuestion.value,
      is_shared: form.is_shared,
      query,
      chart_type: chartType.value,
      locale: locale.value,
    }
    if (editingReport.value) {
      await reportGeneratorService.saved.update(editingReport.value.id, payload)
      notify.success(t('reports.saved.updatedOk'))
    } else {
      await reportGeneratorService.saved.create(payload)
      notify.success(t('reports.saved.savedOk'))
    }
    saveOpen.value = false
    editingReport.value = null
    await loadSaved()
  } catch (error) {
    notify.error(error?.message || t('reports.errors.loadFailed'))
  } finally {
    savingReport.value = false
  }
}

async function runSaved(report) {
  runningSavedId.value = report.id
  try {
    const response = await reportGeneratorService.saved.run(report.id)
    result.value = response?.data || null
    draftQuery.value = result.value?.query || report.query
    activeQuestion.value = report.question || ''
    question.value = report.question || ''
    resultTitle.value = report.name
    resultSource.value = 'ask'
    chartType.value = report.chart_type || 'auto'
    tab.value = 'ask'
    notify.success(t('reports.notifications.generated'))
    loadSaved()
  } catch (error) {
    notify.error(error?.message || t('reports.errors.generateFailed'))
  } finally {
    runningSavedId.value = null
  }
}

async function duplicateSaved(report) {
  try {
    await reportGeneratorService.saved.create({
      name: t('reports.saved.copyOf', { name: report.name }).slice(0, 120),
      description: report.description,
      question: report.question,
      is_shared: false,
      query: report.query,
      chart_type: report.chart_type,
      locale: locale.value,
    })
    notify.success(t('reports.saved.duplicatedOk'))
    await loadSaved()
  } catch (error) {
    notify.error(error?.message || t('reports.errors.loadFailed'))
  }
}

async function removeSaved(report) {
  const confirmed = await confirmDelete({
    entity: t('reports.saved.title'),
    name: report.name,
    title: t('reports.saved.deleteTitle'),
    message: t('reports.saved.deleteMessage', { name: report.name }),
    onConfirm: () => reportGeneratorService.saved.remove(report.id),
  })
  if (!confirmed) return
  notify.success(t('reports.saved.deletedOk'))
  await loadSaved()
}

async function toggleShare(report) {
  try {
    await reportGeneratorService.saved.update(report.id, { is_shared: !report.is_shared })
    notify.success(t('reports.saved.updatedOk'))
    await loadSaved()
  } catch (error) {
    notify.error(error?.message || t('reports.errors.loadFailed'))
  }
}

// ------------------------------------------------------------- schedules
function openScheduleDialog(payload, isSchedule = false) {
  editingSchedule.value = isSchedule ? payload : null
  scheduleReportId.value = isSchedule ? payload?.saved_report_id : payload?.id ?? null
  scheduleOpen.value = true
}

/** "Schedule" on a fresh result: it must be saved first. */
function scheduleCurrent() {
  if (!savedReports.value.length) {
    notify.warning(t('reports.schedule.saveFirst'))
    openSaveDialog(null)
    return
  }
  openScheduleDialog(null)
}

async function submitSchedule(form) {
  savingSchedule.value = true
  try {
    if (editingSchedule.value) {
      await reportGeneratorService.schedules.update(editingSchedule.value.id, form)
      notify.success(t('reports.schedule.updatedOk'))
    } else {
      await reportGeneratorService.schedules.create(form)
      notify.success(t('reports.schedule.createdOk'))
    }
    scheduleOpen.value = false
    editingSchedule.value = null
    await loadSaved()
  } catch (error) {
    notify.error(error?.message || t('reports.errors.loadFailed'))
  } finally {
    savingSchedule.value = false
  }
}

async function toggleSchedule(item) {
  try {
    await reportGeneratorService.schedules.update(item.id, { ...item, active: !item.active })
    notify.success(t('reports.schedule.updatedOk'))
    await loadSaved()
  } catch (error) {
    notify.error(error?.message || t('reports.errors.loadFailed'))
  }
}

async function removeSchedule(item) {
  const confirmed = await confirmDelete({
    entity: t('reports.schedule.title'),
    name: item.report_name,
    title: t('reports.schedule.cancelTitle'),
    message: t('reports.schedule.cancelMessage'),
    onConfirm: () => reportGeneratorService.schedules.remove(item.id),
  })
  if (!confirmed) return
  notify.success(t('reports.schedule.cancelledOk'))
  await loadSaved()
}

// A saved report whose title is a module label must follow the locale too.
watch(locale, () => {
  if (resultTitle.value && result.value?.meta?.moduleLabelKey && !activeQuestion.value) {
    resultTitle.value = label(result.value.meta.moduleLabelKey)
  }
})
</script>

<style scoped>
.reports-page__tabs {
  margin-block-start: 8px;
}

.reports-page__panels {
  background: transparent;
}

.reports-page__panel {
  padding: 16px 0 0;
}

.reports-page__warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 0;
  color: var(--app-action-warning, #B45309);
}
</style>

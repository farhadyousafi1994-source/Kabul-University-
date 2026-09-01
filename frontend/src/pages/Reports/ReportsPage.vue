<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('admin.reports.title')" :subtitle="t('admin.reports.subtitle')" icon="bar_chart">
      <template #actions>
        <q-btn color="primary" outline size="sm" icon="refresh" :label="t('common.refresh')" :loading="loading" @click="loadList" />
      </template>
    </AppPageHeader>

    <!-- Report picker -->
    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="loadList" />
    <template v-else>
      <div class="row q-col-gutter-md q-mb-md">
        <div v-for="r in reports" :key="r.name" class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered clickable :class="{ 'selected-report': current === r.name }" @click="open(r.name)">
            <q-card-section class="row items-center no-wrap">
              <q-icon name="description" color="primary" size="28px" class="q-mr-sm" />
              <div>
                <div class="text-subtitle2 text-weight-medium">{{ r.title }}</div>
                <div class="text-caption text-grey-6">{{ r.description }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Result table -->
      <template v-if="current">
        <div class="text-subtitle1 text-weight-bold q-mb-sm print-hide">{{ currentTitle }}</div>

        <!-- Shared action bar (same buttons on every table) -->
        <TableActionBar
          class="print-hide"
          :rows="resultRows"
          :columns="resultColumns"
          :filename="`report-${current}`"
          :actions="barActions"
        />

        <div v-if="resultLoading" class="q-mt-sm">
          <q-skeleton type="rect" height="64px" />
        </div>
        <ErrorState v-else-if="resultError" :message="resultError" @retry="() => open(current)" />
        <div v-else class="print-area">
          <div class="print-title text-h6 q-mb-xs">{{ currentTitle }}</div>
          <q-table :rows="resultRows" :columns="resultColumns" row-key="__id" flat bordered dense hide-bottom wrap-cells
            :pagination="{ rowsPerPage: 15 }" class="q-mt-sm">
            <template v-if="!resultRows.length" v-slot:no-data>
              <EmptyState icon="bar_chart" :title="t('common.noData')" :message="t('admin.reports.noReportData')" />
            </template>
          </q-table>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { reportService } from 'src/services/system.service'
import api from 'src/boot/axios'
import { stamp } from 'src/utils/export'

const $q = useQuasar()

const { t } = useI18n()

const reports = ref([])
const loading = ref(false)
const error = ref('')
const current = ref('')
const currentTitle = ref('')
const resultRows = ref([])
const resultColumns = ref([])
const resultLoading = ref(false)
const resultError = ref('')
const exporting = ref(false)

// Authenticated CSV export — the old `:href` + `target="_blank"` variant
// opened the endpoint in a fresh tab WITHOUT the bearer token, so the API
// answered 401 and nothing downloaded. We now fetch the blob through the
// authenticated axios instance and trigger the download from JS.
async function exportCsv() {
  if (!current.value) return
  exporting.value = true
  try {
    const blob = await api.get(`/reports/${current.value}/export`, { responseType: 'blob' })
    if (blob?.type === 'application/json') {
      let message = t('common.exportFailed')
      try {
        const parsed = JSON.parse(await blob.text())
        message = parsed?.message || message
      } catch { /* keep generic */ }
      throw new Error(message)
    }
    const name = `report-${current.value}-${stamp()}.csv`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    $q.notify({ type: 'positive', message: t('common.exportedSuccess') })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.exportFailed') })
  } finally {
    exporting.value = false
  }
}

const barActions = computed(() => [
  {
    key: 'csv',
    icon: 'file_download',
    label: t('admin.reports.exportCsv'),
    color: 'teal',
    show: !!current.value && !resultLoading.value,
    handler: exportCsv,
  },
])

async function loadList() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await reportService.list()
    reports.value = data?.data || []
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

async function open(name) {
  current.value = name
  resultLoading.value = true
  resultError.value = ''
  try {
    const { data } = await reportService.get(name)
    currentTitle.value = data.title
    const rows = data.rows || []
    resultRows.value = rows.map((r, i) => ({ __id: i, ...r }))
    resultColumns.value = rows.length
      ? Object.keys(rows[0]).map((k) => ({ name: k, label: k.replace(/_/g, ' '), field: k, align: 'left' }))
      : []
  } catch (e) {
    resultError.value = e.message || t('common.loadFailed')
    resultRows.value = []
    resultColumns.value = []
  } finally {
    resultLoading.value = false
  }
}

onMounted(loadList)
</script>

<style lang="sass">
.selected-report
  border: 2px solid $primary !important
  background: rgba(27, 94, 32, .05)
</style>

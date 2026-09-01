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
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1 text-weight-bold">{{ currentTitle }}</div>
          <div class="row q-gutter-sm">
            <q-btn size="sm" color="primary" outline icon="file_download" :label="t('admin.reports.exportCsv')" :href="exportUrl" target="_blank" />
          </div>
        </div>
        <div v-if="resultLoading" class="q-mt-sm">
          <q-skeleton type="rect" height="64px" />
        </div>
        <ErrorState v-else-if="resultError" :message="resultError" @retry="() => open(current)" />
        <q-table v-else :rows="resultRows" :columns="resultColumns" row-key="__id" flat bordered dense hide-bottom wrap-cells
          :pagination="{ rowsPerPage: 15 }" class="q-mt-sm">
          <template v-if="!resultRows.length" v-slot:no-data>
            <EmptyState icon="bar_chart" :title="t('common.noData')" :message="t('admin.reports.noReportData')" />
          </template>
        </q-table>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { reportService } from 'src/services/system.service'

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

const exportUrl = computed(() => (current.value ? reportService.exportUrl(current.value) : '#'))

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

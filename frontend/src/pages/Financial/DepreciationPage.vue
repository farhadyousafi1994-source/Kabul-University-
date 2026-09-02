<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('financial.depreciation.title')" :subtitle="t('financial.depreciation.subtitle')" icon="trending_down" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'Depreciation_Report'"
      :title="t('nav.items.depreciation')"
    />

    <div class="ku-toolbar row items-center q-col-gutter-sm print-hide">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" :placeholder="t('assets.searchPlaceholder')">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-input v-model="filters.period" dense outlined clearable placeholder="YYYY-MM" />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('financial.depreciation.title') }}</div>
      <q-table :rows="rows" :columns="columns" row-key="id" flat dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm data-table">
        <template v-slot:body-cell-original_value="props"><q-td :props="props">{{ currency(props.row.original_value) }}</q-td></template>
        <template v-slot:body-cell-accumulated_depreciation="props"><q-td :props="props">{{ currency(props.row.accumulated_depreciation) }}</q-td></template>
        <template v-slot:body-cell-book_value="props"><q-td :props="props" class="text-weight-medium">{{ currency(props.row.book_value) }}</q-td></template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="trending_down" :title="t('common.noData')" :message="t('common.noDataDesc')">
            <template v-if="canCalculate" #action><q-btn :label="t('financial.depreciation.calculate')" color="primary" @click="calculate" /></template>
          </EmptyState>
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { depreciationService } from 'src/services/financial.service'
import { useAuthStore } from 'src/stores/auth'
import { currency } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const barActions = computed(() => [
  {key: 'calculate', icon: 'calculate', label: t('financial.depreciation.calculate'), color: 'teal', show: canCalculate.value, handler: calculate},
])

const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const search = ref('')
const loading = ref(false)
const error = ref('')
const calcLoading = ref(false)
const filters = reactive({ period: '' })

const canCalculate = computed(() => authStore.hasPermission('depreciation.calculate'))

const columns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'period', label: t('common.date'), field: 'period', align: 'left' },
  { name: 'original_value', label: t('financial.depreciation.originalCost'), field: 'original_value', align: 'right' },
  { name: 'accumulated_depreciation', label: t('financial.depreciation.accumulatedDepreciation'), field: 'accumulated_depreciation', align: 'right' },
  { name: 'book_value', label: t('assets.bookValue'), field: 'book_value', align: 'right' },
])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (filters.period) params.period = filters.period
    const { data } = await depreciationService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => filters.period, () => { page.value = 1; load() })

async function calculate() {
  calcLoading.value = true
  try {
    const { data } = await depreciationService.calculate({ period: filters.period || undefined })
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('financial.depreciation.calculated', { period: data?.meta?.period || filters.period || t('financial.depreciation.currentPeriod') }) })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  } finally {
    calcLoading.value = false
  }
}

onMounted(load)
</script>

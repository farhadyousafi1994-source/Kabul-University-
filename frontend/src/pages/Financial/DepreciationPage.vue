<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Depreciation" subtitle="Straight-line depreciation records" icon="trending_down">
      <template #actions>
        <q-btn v-if="canCalculate" color="primary" icon="calculate" label="Run Calculation" size="sm" :loading="calcLoading" @click="calculate" />
      </template>
    </AppPageHeader>

    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" placeholder="Search asset…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-input v-model="filters.period" dense outlined clearable placeholder="Period (YYYY-MM)" />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <q-table :rows="rows" :columns="columns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-original_value="props"><q-td :props="props">{{ currency(props.row.original_value) }}</q-td></template>
        <template v-slot:body-cell-accumulated_depreciation="props"><q-td :props="props">{{ currency(props.row.accumulated_depreciation) }}</q-td></template>
        <template v-slot:body-cell-book_value="props"><q-td :props="props" class="text-weight-medium">{{ currency(props.row.book_value) }}</q-td></template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="trending_down" title="No depreciation records" message="Run a calculation to generate the schedule.">
            <template v-if="canCalculate" #action><q-btn label="Run Calculation" color="primary" @click="calculate" /></template>
          </EmptyState>
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { depreciationService } from 'src/services/financial.service'
import { useAuthStore } from 'src/stores/auth'
import { currency } from 'src/utils/format'

const $q = useQuasar()
const authStore = useAuthStore()

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

import { computed } from 'vue'

const columns = [
  { name: 'asset_code', label: 'Code', field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: 'Asset', field: 'asset_name', align: 'left' },
  { name: 'period', label: 'Period', field: 'period', align: 'left' },
  { name: 'original_value', label: 'Original', field: 'original_value', align: 'right' },
  { name: 'accumulated_depreciation', label: 'Accumulated', field: 'accumulated_depreciation', align: 'right' },
  { name: 'book_value', label: 'Book value', field: 'book_value', align: 'right' },
]

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
    error.value = e.message || 'Failed to load depreciation records.'
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
    $q.notify({ type: 'positive', message: `Calculated for ${data.period} — ${data.data?.length || 0} assets.` })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Calculation failed.' })
  } finally {
    calcLoading.value = false
  }
}

onMounted(load)
</script>

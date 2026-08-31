<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Stock Transactions" subtitle="In/out movements and inter-warehouse transfers" icon="swap_vert">
      <template #actions>
        <q-btn v-if="canTransfer" color="primary" icon="add" label="Record Transaction" size="sm" @click="recordOpen = true" />
        <q-btn v-if="canTransfer" color="info" outline icon="swap_horiz" label="Transfer" size="sm" class="q-ml-sm" @click="transferOpen = true" />
      </template>
    </AppPageHeader>

    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-3">
        <q-select v-model="filters.warehouse_id" :options="warehouseOptions" label="Warehouse" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.type" :options="[{ label: 'In', value: 'in' }, { label: 'Out', value: 'out' }]" label="Type" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <q-table :rows="rows" :columns="columns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-type="props">
          <q-td :props="props">
            <q-chip size="sm" :color="props.row.type === 'in' ? 'positive' : 'deep-orange'" text-color="white" dense>{{ props.row.type === 'in' ? 'IN' : 'OUT' }}</q-chip>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="swap_vert" title="No transactions" message="Stock movements will be listed here." />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <!-- Record transaction dialog -->
    <q-dialog v-model="recordOpen" persistent>
      <q-card style="min-width: 440px; max-width: 600px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Record stock transaction</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="recordOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doRecord" class="row q-col-gutter-md">
            <q-select v-model="recordForm.asset_id" :options="assetOptions" label="Asset *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="recordForm.warehouse_id" :options="warehouseOptions" label="Warehouse *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-select v-model="recordForm.type" :options="[{ label: 'Stock in', value: 'in' }, { label: 'Stock out', value: 'out' }]" label="Type *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model.number="recordForm.quantity" label="Quantity" type="number" dense outlined class="col-6 col-md-3" :rules="[(v) => Number(v) >= 1 || 'At least 1']" />
            <q-input v-model="recordForm.notes" label="Notes" dense outlined class="col-6 col-md-9" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="recordOpen = false" />
              <q-btn label="Record" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Transfer dialog -->
    <q-dialog v-model="transferOpen" persistent>
      <q-card style="min-width: 440px; max-width: 600px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Transfer stock between warehouses</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="transferOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doTransfer" class="row q-col-gutter-md">
            <q-select v-model="transferForm.asset_id" :options="assetOptions" label="Asset *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="transferForm.from_warehouse_id" :options="warehouseOptions" label="From warehouse *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-select v-model="transferForm.to_warehouse_id" :options="warehouseOptions" label="To warehouse *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model.number="transferForm.quantity" label="Quantity" type="number" dense outlined class="col-6 col-md-3" :rules="[(v) => Number(v) >= 1 || 'At least 1']" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="transferOpen = false" />
              <q-btn label="Transfer" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { warehouseActions } from 'src/services/warehouse.service'
import { assetService } from 'src/services/assets.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const $q = useQuasar()
const authStore = useAuthStore()
const { warehouses, opts } = useOptions()
const warehouseOptions = computed(() => opts(warehouses.value))

const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const recordOpen = ref(false)
const transferOpen = ref(false)
const recordForm = reactive({ asset_id: null, warehouse_id: null, type: 'in', quantity: 1, notes: '' })
const transferForm = reactive({ asset_id: null, from_warehouse_id: null, to_warehouse_id: null, quantity: 1 })
const filters = reactive({ warehouse_id: null, type: null })
const assetOptions = ref([])

const required = (v) => !!v || 'This field is required'
const canTransfer = computed(() => authStore.hasPermission('warehouse.transfer'))

const columns = [
  { name: 'created_at', label: 'Date', field: 'created_at', align: 'left', format: (v) => date(v, true) },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'asset_code', label: 'Asset code', field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: 'Asset', field: 'asset_name', align: 'left' },
  { name: 'warehouse_name', label: 'Warehouse', field: 'warehouse_name', align: 'left' },
  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right' },
  { name: 'user_name', label: 'By', field: 'user_name', align: 'left' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id
    if (filters.type) params.type = filters.type
    const { data } = await warehouseActions.transactions(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || 'Failed to load transactions.'
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(() => [filters.warehouse_id, filters.type], () => { page.value = 1; load() })

async function loadAssets() {
  try {
    const { data } = await assetService.list({ per_page: 100 })
    assetOptions.value = (data?.data || []).map((a) => ({ label: `${a.asset_code} — ${a.name}`, value: a.id }))
  } catch { assetOptions.value = [] }
}

watch(recordOpen, (open) => { if (open) { Object.assign(recordForm, { asset_id: null, warehouse_id: null, type: 'in', quantity: 1, notes: '' }); loadAssets() } })
watch(transferOpen, (open) => { if (open) { Object.assign(transferForm, { asset_id: null, from_warehouse_id: null, to_warehouse_id: null, quantity: 1 }); loadAssets() } })

async function doRecord() {
  saving.value = true
  try {
    await warehouseActions.record({ ...recordForm })
    recordOpen.value = false
    $q.notify({ type: 'positive', message: 'Transaction recorded.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function doTransfer() {
  saving.value = true
  try {
    await warehouseActions.transfer({ ...transferForm })
    transferOpen.value = false
    $q.notify({ type: 'positive', message: 'Stock transferred.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

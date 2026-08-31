<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Disposals" subtitle="Sold, donated or scrapped assets — records are never deleted" icon="delete_forever">
      <template #actions>
        <q-btn v-if="canDispose" color="negative" icon="add" label="New Disposal" size="sm" @click="dialogOpen = true" />
      </template>
    </AppPageHeader>

    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" placeholder="Search asset…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="statusOptions" label="Status" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <q-table :rows="rows" :columns="columns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-revenue="props"><q-td :props="props">{{ currency(props.row.revenue) }}</q-td></template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn v-if="canDispose && props.row.status === 'pending_approval'" flat dense round size="sm" color="primary" icon="search" @click="inspect(props.row)"><q-tooltip>Inspect</q-tooltip></q-btn>
            <q-btn v-if="canDispose && props.row.status === 'pending_approval'" flat dense round size="sm" color="positive" icon="check" @click="approve(props.row)"><q-tooltip>Approve</q-tooltip></q-btn>
            <q-btn v-if="canDispose && props.row.status === 'pending_approval'" flat dense round size="sm" color="negative" icon="block" @click="reject(props.row)"><q-tooltip>Reject</q-tooltip></q-btn>
            <q-btn v-if="canDispose && props.row.status === 'approved'" flat dense round size="sm" color="deep-orange" icon="delete_forever" @click="execute(props.row)"><q-tooltip>Execute disposal</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="delete_forever" title="No disposals" message="Disposals retire assets while keeping their history." />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 440px; max-width: 600px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">New disposal request</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.asset_id" :options="assetOptions" label="Asset *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="form.method" :options="methodOptions" label="Method *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model.number="form.revenue" label="Revenue (AFN)" type="number" dense outlined class="col-12 col-md-6" />
            <q-input v-model="form.notes" label="Notes" type="textarea" dense outlined autogrow class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn label="Request disposal" type="submit" color="negative" :loading="saving" />
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
import StatusBadge from 'src/components/common/StatusBadge.vue'
import { disposalService } from 'src/services/financial.service'
import { assetService } from 'src/services/assets.service'
import { useAuthStore } from 'src/stores/auth'
import { currency, date } from 'src/utils/format'

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
const saving = ref(false)
const dialogOpen = ref(false)
const form = reactive({ asset_id: null, method: 'sold', revenue: 0, notes: '' })
const filters = reactive({ status: null })
const assetOptions = ref([])

const statusOptions = [
  { label: 'Pending Approval', value: 'pending_approval' }, { label: 'Approved', value: 'approved' },
  { label: 'Completed', value: 'completed' }, { label: 'Rejected', value: 'rejected' }, { label: 'Draft', value: 'draft' },
]
const methodOptions = [
  { label: 'Sold', value: 'sold' }, { label: 'Donated', value: 'donated' },
  { label: 'Recycled', value: 'recycled' }, { label: 'Destroyed', value: 'destroyed' },
]
const required = (v) => !!v || 'This field is required'
const canDispose = computed(() => authStore.hasPermission('assets.dispose'))

const columns = [
  { name: 'asset_code', label: 'Code', field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: 'Asset', field: 'asset_name', align: 'left' },
  { name: 'method', label: 'Method', field: 'method', align: 'left' },
  { name: 'requested_by_name', label: 'Requested by', field: 'requested_by_name', align: 'left' },
  { name: 'request_date', label: 'Requested', field: 'request_date', align: 'left', format: (v) => date(v) },
  { name: 'revenue', label: 'Revenue', field: 'revenue', align: 'right' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (filters.status) params.status = filters.status
    const { data } = await disposalService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || 'Failed to load disposals.'
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => filters.status, () => { page.value = 1; load() })

watch(dialogOpen, async (open) => {
  if (!open) return
  form.asset_id = null
  form.method = 'sold'
  form.revenue = 0
  form.notes = ''
  try {
    const { data } = await assetService.list({ per_page: 100 })
    assetOptions.value = (data?.data || []).filter((a) => !['disposed', 'retired'].includes(a.status))
      .map((a) => ({ label: `${a.asset_code} — ${a.name}`, value: a.id }))
  } catch { assetOptions.value = [] }
})

async function doCreate() {
  saving.value = true
  try {
    await disposalService.store({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: 'Disposal requested for approval.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function inspect(row) {
  $q.dialog({
    title: 'Inspect before approval',
    message: 'Record inspection notes.',
    cancel: true, persistent: true,
    prompt: { model: row.notes || '', type: 'text' },
  }).onOk(async (notes) => {
    try {
      await disposalService.inspect(row.id, { notes })
      $q.notify({ type: 'positive', message: 'Inspection recorded.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || 'Inspection failed.' })
    }
  })
}

async function approve(row) {
  $q.dialog({ title: 'Approve disposal', message: `Approve disposal of ${row.asset_name}?`, cancel: true, persistent: true })
    .onOk(async () => {
      try {
        await disposalService.approve(row.id)
        $q.notify({ type: 'positive', message: 'Disposal approved.' })
        await load()
      } catch (e) {
        $q.notify({ type: 'negative', message: e.message || 'Approval failed.' })
      }
    })
}

async function reject(row) {
  $q.dialog({ title: 'Reject disposal', message: `Reject disposal of ${row.asset_name}?`, cancel: true, persistent: true, color: 'negative' })
    .onOk(async () => {
      try {
        await disposalService.approve(row.id, false)
        $q.notify({ type: 'positive', message: 'Disposal rejected.' })
        await load()
      } catch (e) {
        $q.notify({ type: 'negative', message: e.message || 'Rejection failed.' })
      }
    })
}

async function execute(row) {
  $q.dialog({
    title: 'Execute disposal',
    message: `Execute disposal of ${row.asset_name}? The asset status becomes “Disposed” and the record is kept forever.`,
    cancel: true, persistent: true, color: 'deep-orange',
  }).onOk(async () => {
    try {
      await disposalService.execute(row.id, {})
      $q.notify({ type: 'positive', message: 'Disposal executed — asset marked disposed.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || 'Execution failed.' })
    }
  })
}

onMounted(load)
</script>

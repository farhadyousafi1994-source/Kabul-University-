<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Asset Requests" subtitle="New assets, replacements and repairs" icon="request_page">
      <template #actions>
        <q-btn v-if="canCreate" color="primary" icon="add" label="New Request" size="sm" @click="dialogOpen = true" />
      </template>
    </AppPageHeader>

    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" placeholder="Search request number or requester…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="statusOptions" label="Status" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.request_type" :options="typeOptions" label="Type" dense outlined clearable emit-value map-options options-dense />
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
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn v-if="canApprove && props.row.status === 'department_approval'" flat dense round size="sm" color="positive" icon="check" @click="departmentApprove(props.row, true)"><q-tooltip>Department approve</q-tooltip></q-btn>
            <q-btn v-if="canApprove && ['department_approval', 'manager_review'].includes(props.row.status)" flat dense round size="sm" color="warning" icon="verified" @click="managerApprove(props.row, true)"><q-tooltip>Manager approve</q-tooltip></q-btn>
            <q-btn v-if="canApprove && ['department_approval', 'manager_review'].includes(props.row.status)" flat dense round size="sm" color="negative" icon="block" @click="reject(props.row)"><q-tooltip>Reject</q-tooltip></q-btn>
            <q-btn v-if="canApprove && props.row.status === 'approved'" flat dense round size="sm" color="positive" icon="flag" @click="complete(props.row)"><q-tooltip>Mark complete</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="request_page" title="No requests" message="Employees request new or replacement assets here." />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <!-- New request dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 440px; max-width: 620px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">New asset request</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.request_type" :options="typeOptions" label="Request type *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="form.department_id" :options="departmentOptions" label="Department" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="form.asset_category_id" :options="categoryOptions" label="Asset category" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-input v-model="form.quantity" label="Quantity" type="number" dense outlined class="col-6 col-md-3" :rules="[(v) => !v || Number(v) >= 1 || 'Must be at least 1']" />
            <q-input v-model="form.reason" label="Reason" type="textarea" dense outlined autogrow class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn label="Create request" type="submit" color="primary" :loading="saving" />
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
import { assetRequestService } from 'src/services/operations.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const $q = useQuasar()
const authStore = useAuthStore()
const { departments, categories, opts } = useOptions()
const departmentOptions = computed(() => opts(departments.value))
const categoryOptions = computed(() => opts(categories.value))

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
const form = reactive({ request_type: 'new_asset', department_id: null, asset_category_id: null, quantity: 1, reason: '' })
const filters = reactive({ status: null, request_type: null })

const statusOptions = [
  { label: 'Draft', value: 'draft' }, { label: 'Department Approval', value: 'department_approval' },
  { label: 'Manager Review', value: 'manager_review' }, { label: 'Approved', value: 'approved' },
  { label: 'Completed', value: 'completed' }, { label: 'Rejected', value: 'rejected' },
]
const typeOptions = [
  { label: 'New asset', value: 'new_asset' }, { label: 'Temporary asset', value: 'temporary_asset' },
  { label: 'Replacement asset', value: 'replacement_asset' }, { label: 'Repair request', value: 'repair_request' },
]
const required = (v) => !!v || 'This field is required'
const canCreate = computed(() => authStore.hasPermission('requests.create'))
const canApprove = computed(() => authStore.hasPermission('requests.approve'))

const columns = [
  { name: 'request_number', label: 'Number', field: 'request_number', align: 'left' },
  { name: 'requester_name', label: 'Requester', field: 'requester_name', align: 'left' },
  { name: 'request_type', label: 'Type', field: 'request_type', align: 'left', format: (v) => v?.replace(/_/g, ' ') },
  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right' },
  { name: 'department_name', label: 'Department', field: 'department_name', align: 'left' },
  { name: 'created_at', label: 'Created', field: 'created_at', align: 'left', format: (v) => date(v) },
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
    if (filters.request_type) params.request_type = filters.request_type
    const { data } = await assetRequestService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || 'Failed to load requests.'
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => [filters.status, filters.request_type], () => { page.value = 1; load() })

async function doCreate() {
  saving.value = true
  try {
    const { data } = await assetRequestService.store({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: 'Request created.' })
    // Created as draft — submit it right away for approval.
    await assetRequestService.submit(data.id)
    $q.notify({ type: 'info', message: 'Request submitted for approval.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function departmentApprove(row, approve) {
  await act(() => assetRequestService.departmentApprove(row.id, approve), row, 'Department approval recorded.')
}
async function managerApprove(row, approve) {
  await act(() => assetRequestService.managerApprove(row.id, approve), row, 'Manager approval recorded.')
}
async function reject(row) {
  await act(() => assetRequestService.managerApprove(row.id, false), row, 'Request rejected.')
}
async function complete(row) {
  await act(() => assetRequestService.complete(row.id), row, 'Request completed.')
}

async function act(fn, row, msg) {
  try {
    await fn()
    $q.notify({ type: 'positive', message: msg })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  }
}

onMounted(load)
</script>

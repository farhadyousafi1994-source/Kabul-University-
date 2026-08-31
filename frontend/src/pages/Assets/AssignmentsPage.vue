<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Assignments" subtitle="Assets assigned to employees" icon="assignment_ind">
      <template #actions>
        <q-btn v-if="canAssign" color="primary" icon="add" label="Assign Asset" size="sm" @click="openAssign" />
      </template>
    </AppPageHeader>

    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" placeholder="Search asset or assignee…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="statusOptions" label="Status" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.assigned_to_user_id" :options="userOptions" label="Assignee" dense outlined clearable emit-value map-options options-dense />
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
            <q-btn v-if="canReturn && props.row.status === 'active'" flat dense round size="sm" color="teal" icon="undo" @click="returnAsset(props.row)">
              <q-tooltip>Return</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="assignment_ind" title="No assignments" message="Assign an available asset to an employee." />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <!-- Assign dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 420px; max-width: 640px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Assign asset</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doAssign" class="column q-gutter-md">
            <q-select v-model="form.asset_id" :options="assignableAssets" label="Asset *" dense outlined emit-value map-options options-dense :rules="[required]" />
            <q-select v-model="form.assigned_to_user_id" :options="userOptions" label="Assign to *" dense outlined emit-value map-options options-dense :rules="[required]" />
            <q-input v-model="form.expected_return_date" label="Expected return date" type="date" dense outlined />
            <q-input v-model="form.notes" label="Notes" type="textarea" dense outlined autogrow />
            <div class="row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn label="Assign" type="submit" color="primary" :loading="saving" />
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
import { assignmentService } from 'src/services/operations.service'
import { assetService } from 'src/services/assets.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const $q = useQuasar()
const authStore = useAuthStore()
const { users, opts } = useOptions()
const userOptions = computed(() => opts(users.value))

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
const form = reactive({ asset_id: null, assigned_to_user_id: null, expected_return_date: null, notes: '' })
const filters = reactive({ status: null, assigned_to_user_id: null })
const assignableAssets = ref([])

const statusOptions = [
  { label: 'Active', value: 'active' }, { label: 'Returned', value: 'returned' }, { label: 'Overdue', value: 'overdue' },
]
const required = (v) => !!v || 'This field is required'
const canAssign = computed(() => authStore.hasPermission('assets.assign'))
const canReturn = computed(() => authStore.hasPermission('assets.return'))

const columns = [
  { name: 'asset_code', label: 'Code', field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: 'Asset', field: 'asset_name', align: 'left' },
  { name: 'assignee_name', label: 'Assignee', field: 'assignee_name', align: 'left' },
  { name: 'assigned_date', label: 'Assigned', field: 'assigned_date', align: 'left', format: (v) => date(v) },
  { name: 'expected_return_date', label: 'Expected return', field: 'expected_return_date', align: 'left', format: (v) => date(v) },
  { name: 'returned_date', label: 'Returned', field: 'returned_date', align: 'left', format: (v) => date(v) },
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
    if (filters.assigned_to_user_id) params.assigned_to_user_id = filters.assigned_to_user_id
    const { data } = await assignmentService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || 'Failed to load assignments.'
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => [filters.status, filters.assigned_to_user_id], () => { page.value = 1; load() })

async function openAssign() {
  form.asset_id = null
  form.assigned_to_user_id = null
  form.expected_return_date = null
  form.notes = ''
  dialogOpen.value = true
  try {
    const { data } = await assetService.list({ status: 'available', per_page: 100 })
    assignableAssets.value = (data?.data || []).map((a) => ({ label: `${a.asset_code} — ${a.name}`, value: a.id }))
  } catch { assignableAssets.value = [] }
}

async function doAssign() {
  saving.value = true
  try {
    await assignmentService.assign(form.asset_id, { ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: 'Asset assigned.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

function returnAsset(row) {
  $q.dialog({
    title: 'Return asset',
    message: `Return “${row.asset_name}” from ${row.assignee_name}? The asset will become available.`,
    cancel: true, persistent: true,
  }).onOk(async () => {
    try {
      await assignmentService.returnAsset(row.id, { condition_on_return: 'good' })
      $q.notify({ type: 'positive', message: 'Asset returned.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

onMounted(load)
</script>

<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Incidents" subtitle="Loss, theft, damage and destruction reports" icon="report_problem">
      <template #actions>
        <q-btn v-if="canCreate" color="negative" icon="add" label="Report Incident" size="sm" @click="dialogOpen = true" />
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
      <div class="col-6 col-md-2">
        <q-select v-model="filters.incident_type" :options="typeOptions" label="Type" dense outlined clearable emit-value map-options options-dense />
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
        <template v-slot:body-cell-incident_type="props">
          <q-td :props="props">
            <q-chip size="sm" :color="{ lost: 'grey-8', stolen: 'brown', damaged: 'deep-orange', destroyed: 'negative' }[props.row.incident_type] || 'grey'" text-color="white" dense>{{ props.row.incident_type }}</q-chip>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn v-if="canUpdate && ['open', 'investigating'].includes(props.row.status)" flat dense round size="sm" color="primary" icon="edit_note" @click="updateStatus(props.row)"><q-tooltip>Update status</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="verified_user" title="No incidents" message="Reported incidents will be listed here." />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 440px; max-width: 620px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Report incident</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.asset_id" :options="assetOptions" label="Asset *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="form.incident_type" :options="typeOptions" label="Type *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model="form.incident_date" label="Incident date" type="date" dense outlined class="col-12 col-md-6" />
            <q-input v-model="form.description" label="Description *" type="textarea" dense outlined autogrow :rules="[required]" class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn label="Report" type="submit" color="negative" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import { incidentService } from 'src/services/maintenance.service'
import { assetService } from 'src/services/assets.service'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

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
const form = reactive({ asset_id: null, incident_type: 'damaged', incident_date: '', description: '' })
const filters = reactive({ status: null, incident_type: null })
const assetOptions = ref([])

const statusOptions = [
  { label: 'Open', value: 'open' }, { label: 'Investigating', value: 'investigating' },
  { label: 'Resolved', value: 'resolved' }, { label: 'Closed', value: 'closed' },
]
const typeOptions = [
  { label: 'Damaged', value: 'damaged' }, { label: 'Lost', value: 'lost' },
  { label: 'Stolen', value: 'stolen' }, { label: 'Destroyed', value: 'destroyed' },
]
const required = (v) => !!v || 'This field is required'
const canCreate = computed(() => authStore.hasPermission('incidents.create'))
const canUpdate = computed(() => authStore.hasPermission('incidents.update'))

import { computed } from 'vue'

const columns = [
  { name: 'asset_code', label: 'Code', field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: 'Asset', field: 'asset_name', align: 'left' },
  { name: 'incident_type', label: 'Type', field: 'incident_type', align: 'left' },
  { name: 'incident_date', label: 'Date', field: 'incident_date', align: 'left', format: (v) => date(v) },
  { name: 'reporter_name', label: 'Reported by', field: 'reporter_name', align: 'left' },
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
    if (filters.incident_type) params.incident_type = filters.incident_type
    const { data } = await incidentService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || 'Failed to load incidents.'
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => [filters.status, filters.incident_type], () => { page.value = 1; load() })

watch(dialogOpen, async (open) => {
  if (!open) return
  form.asset_id = null
  form.incident_type = 'damaged'
  form.incident_date = new Date().toISOString().slice(0, 10)
  form.description = ''
  try {
    const { data } = await assetService.list({ per_page: 100 })
    assetOptions.value = (data?.data || []).map((a) => ({ label: `${a.asset_code} — ${a.name}`, value: a.id }))
  } catch { assetOptions.value = [] }
})

async function doCreate() {
  saving.value = true
  try {
    await incidentService.store({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: 'Incident reported. Asset status updated.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function updateStatus(row) {
  $q.dialog({
    title: 'Update incident status',
    message: `Next status for incident on ${row.asset_name}.`,
    cancel: true, persistent: true,
    options: {
      type: 'radio',
      model: row.status,
      items: [
        { label: 'Open', value: 'open' },
        { label: 'Investigating', value: 'investigating' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Closed', value: 'closed' },
      ],
    },
  }).onOk(async (status) => {
    try {
      await incidentService.updateStatus(row.id, { status, resolution: status === 'resolved' || status === 'closed' ? 'Handled' : null })
      $q.notify({ type: 'positive', message: 'Incident updated.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

onMounted(load)
</script>

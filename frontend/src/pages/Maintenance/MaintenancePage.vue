<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('maintenance.title')" :subtitle="t('maintenance.subtitle')" icon="build" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="tab === 'requests' ? requestColumns : orderColumns"
      :filename="'Maintenance_Report'"
      :title="t('nav.items.maintenance')"
    />

    <q-tabs v-model="tab" class="q-mb-md" dense>
      <q-tab name="requests" icon="report_problem" :label="t('maintenance.requestsTab')" />
      <q-tab name="orders" icon="engineering" :label="t('maintenance.workOrdersTab')" />
    </q-tabs>

    <div class="row items-center q-col-gutter-sm q-mb-sm print-hide">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" :placeholder="t('assets.searchPlaceholder')">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="tab === 'requests' ? requestStatusOptions : orderStatusOptions" :label="t('common.status')" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('maintenance.title') }}</div>
      <q-table :rows="rows" :columns="tab === 'requests' ? requestColumns : orderColumns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-priority="props">
          <q-td :props="props">
            <q-chip size="sm" :color="{ low: 'positive', medium: 'warning', high: 'deep-orange', urgent: 'negative' }[props.row.priority] || 'grey'" text-color="white" dense>
              {{ priorityLabel(props.row.priority) }}
            </q-chip>
          </q-td>
        </template>
        <template v-slot:body-cell-maintenance_type="props">
          <q-td :props="props">
            {{ typeLabel(props.row.maintenance_type) }}
          </q-td>
        </template>
        <template v-slot:body-cell-cost="props">
          <q-td :props="props">{{ currency(props.row.cost) }}</q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <template v-if="tab === 'requests'">
              <q-btn v-if="canUpdate && props.row.status === 'requested'" flat dense round size="sm" color="positive" icon="check" @click="approveRequest(props.row)"><q-tooltip>{{ t('maintenance.approveRequest') }}</q-tooltip></q-btn>
              <q-btn v-if="canCreate && props.row.status === 'approved'" flat dense round size="sm" color="primary" icon="engineering" @click="createOrder(props.row)"><q-tooltip>{{ t('maintenance.createWorkOrder') }}</q-tooltip></q-btn>
            </template>
            <template v-else>
              <q-btn v-if="canUpdate && props.row.status === 'approved'" flat dense round size="sm" color="warning" icon="person_add" @click="assignTechnician(props.row)"><q-tooltip>{{ t('maintenance.assignTechnician') }}</q-tooltip></q-btn>
              <q-btn v-if="canUpdate && ['assigned', 'approved'].includes(props.row.status)" flat dense round size="sm" color="warning" icon="play_arrow" @click="transition(props.row, 'in_progress')"><q-tooltip>{{ t('maintenance.startWork') }}</q-tooltip></q-btn>
              <q-btn v-if="canUpdate && props.row.status === 'in_progress'" flat dense round size="sm" color="positive" icon="flag" @click="completeOrder(props.row)"><q-tooltip>{{ t('maintenance.completeWork') }}</q-tooltip></q-btn>
            </template>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState :icon="tab === 'requests' ? 'report_problem' : 'engineering'" :title="tab === 'requests' ? t('maintenance.noRequests') : t('maintenance.noOrders')" :message="t('common.noDataDesc')" />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>

    <!-- New maintenance request dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 440px; max-width: 620px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('maintenance.newRequest') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.asset_id" :options="assetOptions" :label="`${t('assignments.asset')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="form.maintenance_type" :options="typeOptions" :label="`${t('maintenance.maintenanceType')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-6 col-md-6" />
            <q-select v-model="form.priority" :options="priorityOptions" :label="t('common.priority')" dense outlined emit-value map-options options-dense class="col-6 col-md-6" />
            <q-input v-model="form.problem" :label="t('maintenance.problemDescription')" type="textarea" dense outlined autogrow :rules="[required]" class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn :label="t('common.save')" type="submit" color="primary" :loading="saving" />
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
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import { maintenanceService } from 'src/services/maintenance.service'
import { assetService } from 'src/services/assets.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { currency, date } from 'src/utils/format'

const { t, te } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const { users, opts } = useOptions()
const userOptions = computed(() => opts(users.value))

const tab = ref('requests')
const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('maintenance.newRequest'), color: 'teal', show: canCreate.value, handler: openRequest},
])

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
const form = reactive({ asset_id: null, maintenance_type: 'corrective', priority: 'medium', problem: '' })
const filters = reactive({ status: null })
const assetOptions = ref([])

const requestStatusOptions = computed(() => [
  { label: t('status.requested'), value: 'requested' },
  { label: t('status.approved'), value: 'approved' },
  { label: t('status.rejected'), value: 'rejected' },
])

const orderStatusOptions = computed(() => [
  { label: t('status.approved'), value: 'approved' },
  { label: t('status.assigned'), value: 'assigned' },
  { label: t('status.in_progress'), value: 'in_progress' },
  { label: t('status.completed'), value: 'completed' },
  { label: t('status.cancelled'), value: 'cancelled' },
])

const typeOptions = computed(() => [
  { label: t('maintenanceType.preventive'), value: 'preventive' },
  { label: t('maintenanceType.corrective'), value: 'corrective' },
  { label: t('maintenanceType.emergency'), value: 'emergency' },
  { label: t('maintenanceType.inspection'), value: 'inspection' },
])

const priorityOptions = computed(() => [
  { label: t('priority.low'), value: 'low' },
  { label: t('priority.medium'), value: 'medium' },
  { label: t('priority.high'), value: 'high' },
  { label: t('priority.urgent'), value: 'urgent' },
])

function priorityLabel(p) {
  return te(`priority.${p}`) ? t(`priority.${p}`) : p
}

function typeLabel(type) {
  return te(`maintenanceType.${type}`) ? t(`maintenanceType.${type}`) : type
}

const required = (v) => !!v || t('common.required')
const canCreate = computed(() => authStore.hasPermission('maintenance.create'))
const canUpdate = computed(() => authStore.hasPermission('maintenance.update'))

const requestColumns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'maintenance_type', label: t('maintenance.maintenanceType'), field: 'maintenance_type', align: 'left' },
  { name: 'priority', label: t('common.priority'), field: 'priority', align: 'left' },
  { name: 'problem', label: t('maintenance.problem'), field: 'problem', align: 'left' },
  { name: 'requester_name', label: t('maintenance.requester'), field: 'requester_name', align: 'left' },
  { name: 'created_at', label: t('common.created'), field: 'created_at', align: 'left', format: (v) => date(v) },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

const orderColumns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'maintenance_type', label: t('maintenance.maintenanceType'), field: 'maintenance_type', align: 'left' },
  { name: 'technician_name', label: t('maintenance.technician'), field: 'technician_name', align: 'left' },
  { name: 'start_date', label: t('maintenance.startDate'), field: 'start_date', align: 'left', format: (v) => date(v) },
  { name: 'end_date', label: t('maintenance.endDate'), field: 'end_date', align: 'left', format: (v) => date(v) },
  { name: 'cost', label: t('maintenance.cost'), field: 'cost', align: 'right' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (filters.status) params.status = filters.status
    const { data } = await (tab.value === 'requests' ? maintenanceService.requests(params) : maintenanceService.list(params))
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
watch(filters, () => { page.value = 1; load() }, { deep: true })
watch(tab, () => { page.value = 1; filters.status = null; load() })

async function openRequest() {
  form.asset_id = null
  form.maintenance_type = 'corrective'
  form.priority = 'medium'
  form.problem = ''
  dialogOpen.value = true
  try {
    const { data } = await assetService.list({ per_page: 100 })
    assetOptions.value = (data?.data || []).map((a) => ({ label: `${a.asset_code} — ${a.name}`, value: a.id }))
  } catch { assetOptions.value = [] }
}

async function doCreate() {
  if (saving.value) return // prevent duplicate submissions
  saving.value = true
  try {
    await maintenanceService.createRequest({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.createdSuccessEntity', { entity: t('common.entities.maintenance') }) })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function approveRequest(row) {
  try {
    await maintenanceService.approveRequest(row.id)
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.updatedSuccessEntity', { entity: t('common.entities.maintenance') }) })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  }
}

async function createOrder(row) {
  $q.dialog({
    title: t('maintenance.createWorkOrder'),
    message: `${t('maintenance.createWorkOrder')} ${row.asset_name}?`,
    cancel: true, persistent: true,
  }).onOk(async () => {
    try {
      await maintenanceService.create({ asset_id: row.asset_id, maintenance_request_id: row.id, maintenance_type: row.maintenance_type })
      $q.notify({ type: 'positive', icon: 'check_circle', message: t('maintenance.workOrderCreated') })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    }
  })
}

async function assignTechnician(row) {
  $q.dialog({
    title: t('maintenance.assignTechnician'),
    message: t('maintenance.chooseTechnician'),
    cancel: true, persistent: true,
    prompt: { model: '', type: 'text', isValid: (v) => !!v },
  }).onOk(async (name) => {
    const tech = userOptions.value.find((o) => o.label.toLowerCase().includes(name.toLowerCase()))?.value || null
    try {
      await maintenanceService.transition(row.id, { status: 'assigned', technician_id: tech })
      $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.updatedSuccessEntity', { entity: t('common.entities.maintenance') }) })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    }
  })
}

async function transition(row, status) {
  try {
    await maintenanceService.transition(row.id, { status })
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.updatedSuccessEntity', { entity: t('common.entities.maintenance') }) })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  }
}

async function completeOrder(row) {
  $q.dialog({
    title: t('maintenance.completeWork'),
    message: t('maintenance.recordResult'),
    cancel: true, persistent: true,
    prompt: { model: 'Completed successfully', type: 'text' },
  }).onOk(async (result) => {
    const costInput = await new Promise((resolve) => {
      $q.dialog({
        title: `${t('maintenance.cost')}`,
        cancel: true, persistent: true,
        prompt: { model: String(row.cost || 0), type: 'number' },
      }).onOk((v) => resolve(Number(v))).onCancel(() => resolve(row.cost || 0))
    })
    try {
      await maintenanceService.transition(row.id, { status: 'completed', result, cost: costInput })
      $q.notify({ type: 'positive', icon: 'check_circle', message: t('maintenance.workOrderCompleted') })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    }
  })
}

onMounted(load)
</script>

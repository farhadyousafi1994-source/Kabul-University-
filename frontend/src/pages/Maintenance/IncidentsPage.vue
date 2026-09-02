<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('incidents.title')" :subtitle="t('incidents.subtitle')" icon="report_problem" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'Incidents_Report'"
      :title="t('nav.items.incidents')"
    />

    <div class="row items-center q-col-gutter-sm q-mb-sm print-hide">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" :placeholder="t('assets.searchPlaceholder')">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="statusOptions" :label="t('common.status')" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.incident_type" :options="typeOptions" :label="t('common.type')" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('incidents.title') }}</div>
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
            <q-btn v-if="canUpdate && ['open', 'investigating'].includes(props.row.status)" flat dense round size="sm" color="primary" icon="edit_note" @click="updateStatus(props.row)"><q-tooltip>{{ t('common.edit') }}</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="verified_user" :title="t('common.noData')" :message="t('common.noDataDesc')" />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 440px; max-width: 620px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('incidents.reportIncident') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.asset_id" :options="assetOptions" :label="`${t('assignments.asset')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="form.incident_type" :options="typeOptions" :label="`${t('common.type')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model="form.incident_date" :label="t('incidents.incidentDate')" type="date" dense outlined class="col-12 col-md-6" />
            <q-input v-model="form.description" :label="`${t('common.description')} *`" type="textarea" dense outlined autogrow :rules="[required]" class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn :label="t('common.submit')" type="submit" color="negative" :loading="saving" />
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
import { incidentService } from 'src/services/maintenance.service'
import { assetService } from 'src/services/assets.service'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('incidents.reportIncident'), color: 'red-7', show: canCreate.value, handler: () => { dialogOpen.value = true }},
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
const form = reactive({ asset_id: null, incident_type: 'damaged', incident_date: '', description: '' })
const filters = reactive({ status: null, incident_type: null })
const assetOptions = ref([])

const statusOptions = computed(() => [
  { label: t('status.open'), value: 'open' },
  { label: t('status.investigating'), value: 'investigating' },
  { label: t('status.resolved'), value: 'resolved' },
  { label: t('status.closed'), value: 'closed' },
])

const typeOptions = computed(() => [
  { label: t('status.damaged'), value: 'damaged' },
  { label: t('status.lost'), value: 'lost' },
  { label: t('status.stolen'), value: 'stolen' },
  { label: t('financial.disposals.methods.destroyed'), value: 'destroyed' },
])

const required = (v) => !!v || t('common.required')
const canCreate = computed(() => authStore.hasPermission('incidents.create'))
const canUpdate = computed(() => authStore.hasPermission('incidents.update'))

const columns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'incident_type', label: t('common.type'), field: 'incident_type', align: 'left' },
  { name: 'incident_date', label: t('incidents.incidentDate'), field: 'incident_date', align: 'left', format: (v) => date(v) },
  { name: 'reporter_name', label: t('incidents.reportedBy'), field: 'reporter_name', align: 'left' },
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
    if (filters.incident_type) params.incident_type = filters.incident_type
    const { data } = await incidentService.list(params)
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
  if (saving.value) return // prevent duplicate submissions
  saving.value = true
  try {
    await incidentService.store({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.createdSuccessEntity', { entity: t('common.entities.incident') }) })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function updateStatus(row) {
  $q.dialog({
    title: t('common.status'),
    message: `${t('common.status')}: ${row.asset_name}.`,
    cancel: true, persistent: true,
    options: {
      type: 'radio',
      model: row.status,
      items: [
        { label: t('status.open'), value: 'open' },
        { label: t('status.investigating'), value: 'investigating' },
        { label: t('status.resolved'), value: 'resolved' },
        { label: t('status.closed'), value: 'closed' },
      ],
    },
  }).onOk(async (status) => {
    try {
      await incidentService.updateStatus(row.id, { status, resolution: status === 'resolved' || status === 'closed' ? 'Handled' : null })
      $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.savedSuccessEntity', { entity: t('common.entities.incident') }) })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

onMounted(load)
</script>

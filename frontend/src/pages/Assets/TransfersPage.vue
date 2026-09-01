<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('transfers.title')" :subtitle="t('transfers.subtitle')" icon="swap_horiz" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'transfers'"
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
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('transfers.title') }}</div>
      <q-table :rows="rows" :columns="columns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn v-if="canTransfer && props.row.status === 'requested'" flat dense round size="sm" color="positive" icon="check" @click="transition(props.row, 'approved')"><q-tooltip>{{ t('status.approved') }}</q-tooltip></q-btn>
            <q-btn v-if="canTransfer && props.row.status === 'approved'" flat dense round size="sm" color="warning" icon="local_shipping" @click="transition(props.row, 'in_transit')"><q-tooltip>{{ t('status.in_transit') }}</q-tooltip></q-btn>
            <q-btn v-if="canTransfer && props.row.status === 'in_transit'" flat dense round size="sm" color="positive" icon="flag" @click="transition(props.row, 'completed')"><q-tooltip>{{ t('status.completed') }}</q-tooltip></q-btn>
            <q-btn v-if="canTransfer && ['requested', 'approved', 'in_transit'].includes(props.row.status)" flat dense round size="sm" color="negative" icon="block" @click="transition(props.row, 'rejected')"><q-tooltip>{{ t('status.rejected') }}</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="swap_horiz" :title="t('common.noData')" :message="t('common.noDataDesc')" />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>

    <!-- New transfer dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 460px; max-width: 700px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('transfers.newTransfer') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.asset_id" :options="assetOptions" :label="`${t('assignments.asset')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="form.to_campus_id" :options="campusOptions" :label="t('assets.toCampus')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="form.to_faculty_id" :options="facultyOptions" :label="t('assets.toFaculty')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="form.to_department_id" :options="departmentOptions" :label="t('assets.toDepartment')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="form.to_building_id" :options="buildingOptions" :label="t('assets.toBuilding')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="form.to_floor_id" :options="floorOptions" :label="t('assets.toFloor')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="form.to_room_id" :options="roomOptions" :label="t('assets.toRoom')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-input v-model="form.notes" :label="t('common.notes')" type="textarea" dense outlined autogrow class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn :label="t('assets.requestTransfer')" type="submit" color="primary" :loading="saving" />
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
import { transferService } from 'src/services/operations.service'
import { assetService } from 'src/services/assets.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const { campuses, faculties, departments, buildings, floors, rooms, opts } = useOptions()
const campusOptions = computed(() => opts(campuses.value))
const facultyOptions = computed(() => opts(faculties.value))
const departmentOptions = computed(() => opts(departments.value))
const buildingOptions = computed(() => opts(buildings.value))
const floorOptions = computed(() => opts(floors.value))
const roomOptions = computed(() => opts(rooms.value))

const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('transfers.newTransfer'), color: 'teal', show: canTransfer.value, handler: () => { dialogOpen.value = true }},
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
const form = reactive({ asset_id: null, to_campus_id: null, to_faculty_id: null, to_department_id: null, to_building_id: null, to_floor_id: null, to_room_id: null, notes: '' })
const filters = reactive({ status: null })
const assetOptions = ref([])

const statusOptions = computed(() => [
  { label: t('status.requested'), value: 'requested' },
  { label: t('status.approved'), value: 'approved' },
  { label: t('status.in_transit'), value: 'in_transit' },
  { label: t('status.completed'), value: 'completed' },
  { label: t('status.rejected'), value: 'rejected' },
  { label: t('status.draft'), value: 'draft' },
])

const required = (v) => !!v || t('common.required')
const canTransfer = computed(() => authStore.hasPermission('assets.transfer'))

const columns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'to_department_id', label: t('assets.toDepartment'), field: 'to_department_id', align: 'left' },
  { name: 'requester_name', label: t('transfers.requestedBy'), field: 'requester_name', align: 'left' },
  { name: 'created_at', label: t('transfers.transferDate'), field: 'created_at', align: 'left', format: (v) => date(v) },
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
    const { data } = await transferService.list(params)
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
watch(() => filters.status, () => { page.value = 1; load() })

async function doCreate() {
  saving.value = true
  try {
    await transferService.store(form.asset_id, { ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: t('assets.transferCreated') })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  } finally {
    saving.value = false
  }
}

async function transition(row, status) {
  try {
    await transferService.transition(row.id, status)
    $q.notify({ type: 'positive', message: t('common.updatedSuccess') })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  }
}

watch(dialogOpen, async (open) => {
  if (!open) return
  form.asset_id = null
  Object.keys(form).forEach((k) => { if (k !== 'asset_id') form[k] = null })
  try {
    const { data } = await assetService.list({ per_page: 100 })
    assetOptions.value = (data?.data || []).map((a) => ({ label: `${a.asset_code} — ${a.name}`, value: a.id }))
  } catch { assetOptions.value = [] }
})

onMounted(load)
</script>

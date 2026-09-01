<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('assets.title')" :subtitle="t('assets.subtitle')" icon="inventory_2" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'assets'"
    />

    <!-- Toolbar -->
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
        <q-select v-model="filters.category_id" :options="categoryOptions" :label="t('common.category')" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.department_id" :options="departmentOptions" :label="t('common.department')" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-input v-model="filters.code" dense outlined clearable :placeholder="t('assets.scanPlaceholder')" @keyup.enter="applyScan">
          <template #prepend><q-icon name="qr_code_scanner" /></template>
        </q-input>
      </div>
    </div>

    <!-- Loading / error / empty -->
    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('assets.title') }}</div>
      <q-table :rows="rows" :columns="columns" row-key="id" flat bordered dense hide-bottom wrap-cells
        :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-condition="props">
          <q-td :props="props"><StatusBadge :value="props.row.condition" /></q-td>
        </template>
        <template v-slot:body-cell-name="props">
          <q-td :props="props">
            <router-link :to="{ name: 'asset-detail', params: { id: props.row.id } }" class="text-primary text-weight-medium">
              {{ props.row.name }}
            </router-link>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat dense round size="sm" color="primary" icon="visibility" :to="{ name: 'asset-detail', params: { id: props.row.id } }">
              <q-tooltip>{{ t('common.view') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="canAssign && ['available', 'reserved'].includes(props.row.status)" flat dense round size="sm" color="info" icon="assignment_ind" @click="openAssign(props.row)">
              <q-tooltip>{{ t('assets.assignAsset') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="canEdit" flat dense round size="sm" color="primary" icon="edit" @click="openEdit(props.row)">
              <q-tooltip>{{ t('common.edit') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="canDelete" flat dense round size="sm" color="negative" icon="delete_outline" @click="confirmArchive(props.row)">
              <q-tooltip>{{ t('common.archive') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="inventory_2" :title="t('common.noData')" :message="t('common.noDataDesc')" :action-label="t('assets.addAsset')" @action="openCreate" />
        </template>
      </q-table>

      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
      </div>
    </template>

    <!-- Create / edit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card class="q-dialog-card" style="min-width: 480px; max-width: 860px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ editing ? t('assets.editAsset') : t('assets.addAsset') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="save" class="row q-col-gutter-md">
            <q-input v-model="form.name" :label="`${t('common.name')} *`" dense outlined class="col-12" :rules="[required]"/>
            <q-select v-model="form.category_id" :options="categoryOptions" :label="`${t('common.category')} *`" dense outlined emit-value map-options options-dense class="col-12 col-md-6" :rules="[required]"/>
            <q-select v-model="form.subcategory_id" :options="subcategoryOptions" :label="t('common.subcategory')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6"/>
            <q-input v-model="form.brand" :label="t('assets.brand')" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.model" :label="t('assets.model')" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.serial_number" :label="t('assets.serialNumber')" dense outlined class="col-6 col-md-3"/>
            <q-select v-model="form.supplier_id" :options="supplierOptions" :label="t('common.supplier')" dense outlined emit-value map-options options-dense clearable class="col-6 col-md-3"/>
            <q-input v-model="form.purchase_date" :label="t('assets.purchaseDate')" type="date" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.purchase_price" :label="t('assets.purchasePrice')" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.current_value" :label="t('assets.currentValue')" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.salvage_value" :label="t('assets.salvageValue')" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.useful_life" :label="t('assets.usefulLife')" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.warranty_expiry_date" :label="t('assets.warrantyExpiry')" type="date" dense outlined class="col-6 col-md-3"/>
            <q-select v-model="form.status" :options="statusOptions" :label="t('common.status')" dense outlined emit-value map-options options-dense class="col-6 col-md-3"/>
            <q-select v-model="form.condition" :options="conditionOptions" :label="t('common.condition')" dense outlined emit-value map-options options-dense class="col-6 col-md-3"/>
            <q-select v-model="form.campus_id" :options="campusOptions" :label="t('common.campus')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.faculty_id" :options="facultyOptions" :label="t('common.faculty')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.department_id" :options="departmentOptions" :label="t('common.department')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.building_id" :options="buildingOptions" :label="t('common.building')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.floor_id" :options="floorOptions" :label="t('common.floor')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.room_id" :options="roomOptions" :label="t('common.room')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-input v-model="form.description" :label="t('common.description')" type="textarea" dense outlined autogrow class="col-12"/>
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false"/>
              <q-btn :label="t('common.save')" type="submit" color="primary" :loading="saving"/>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Assign dialog -->
    <q-dialog v-model="assignOpen" persistent>
      <q-card style="min-width: 380px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('assets.assignAsset') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="assignOpen = false"/>
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-sm">{{ assignTarget?.name }} · {{ assignTarget?.asset_code }}</div>
          <q-form @submit="doAssign" class="column q-gutter-md">
            <UserSelect v-model="assignForm.assigned_to_user_id" :label="`${t('assets.assignTo')} *`" dense outlined :rules="[required]"/>
            <q-input v-model="assignForm.expected_return_date" :label="t('assets.expectedReturnDate')" type="date" dense outlined/>
            <q-input v-model="assignForm.notes" :label="t('common.notes')" type="textarea" dense outlined autogrow/>
            <div class="row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="assignOpen = false"/>
              <q-btn :label="t('assets.assignAsset')" type="submit" color="primary" :loading="assigning"/>
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
import UserSelect from 'src/components/common/UserSelect.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import { assetService } from 'src/services/assets.service'
import { assignmentService } from 'src/services/operations.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { currency, date } from 'src/utils/format'

const { t, te } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const { categories, subcategories, suppliers, campuses, faculties, departments, buildings, floors, rooms, opts } = useOptions()

const categoryOptions = computed(() => opts(categories.value))
const subcategoryOptions = computed(() => opts(subcategories.value))
const supplierOptions = computed(() => opts(suppliers.value))
const campusOptions = computed(() => opts(campuses.value))
const facultyOptions = computed(() => opts(faculties.value))
const departmentOptions = computed(() => opts(departments.value))
const buildingOptions = computed(() => opts(buildings.value))
const floorOptions = computed(() => opts(floors.value))
const roomOptions = computed(() => opts(rooms.value))

const statusOptions = computed(() => [
  { label: t('status.available'), value: 'available' },
  { label: t('status.assigned'), value: 'assigned' },
  { label: t('status.reserved'), value: 'reserved' },
  { label: t('status.under_maintenance'), value: 'under_maintenance' },
  { label: t('status.damaged'), value: 'damaged' },
  { label: t('status.lost'), value: 'lost' },
  { label: t('status.stolen'), value: 'stolen' },
  { label: t('status.disposed'), value: 'disposed' },
  { label: t('status.retired'), value: 'retired' },
])

const conditionOptions = computed(() => [
  { label: t('condition.excellent'), value: 'excellent' },
  { label: t('condition.good'), value: 'good' },
  { label: t('condition.fair'), value: 'fair' },
  { label: t('condition.poor'), value: 'poor' },
  { label: t('condition.damaged'), value: 'damaged' },
])

const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const search = ref('')
const loading = ref(false)
const error = ref('')
const dialogOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = reactive({ status: 'available', condition: 'good', useful_life: 5 })

const assignOpen = ref(false)
const assigning = ref(false)
const assignTarget = ref(null)
const assignForm = reactive({ assigned_to_user_id: null, expected_return_date: null, notes: '' })

const filters = reactive({ status: null, category_id: null, department_id: null, code: '' })
const scanCode = ref('')
const required = (v) => (v !== null && v !== undefined && String(v).trim() !== '') || t('common.required')

const canCreate = computed(() => authStore.hasPermission('assets.create'))
const canEdit = computed(() => authStore.hasPermission('assets.update'))
const canDelete = computed(() => authStore.hasPermission('assets.delete'))
const canAssign = computed(() => authStore.hasPermission('assets.assign'))

const barActions = computed(() => [
  { key: 'add', icon: 'add', label: t('assets.addAsset'), color: 'teal', show: canCreate.value, handler: openCreate },
])

const columns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'category_name', label: t('common.category'), field: 'category_name', align: 'left' },
  { name: 'purchase_price', label: t('common.price'), field: 'purchase_price', align: 'right', format: (v) => currency(v) },
  { name: 'current_value', label: t('common.value'), field: 'current_value', align: 'right', format: (v) => currency(v) },
  { name: 'department_name', label: t('common.department'), field: 'department_name', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'condition', label: t('common.condition'), field: 'condition', align: 'left' },
  { name: 'purchase_date', label: t('assets.purchaseDate'), field: 'purchase_date', align: 'left', format: (v) => date(v) },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (filters.status) params.status = filters.status
    if (filters.category_id) params.category_id = filters.category_id
    if (filters.department_id) params.department_id = filters.department_id
    if (scanCode.value) params.code = scanCode.value
    const { data } = await assetService.list(params)
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
watch(() => [filters.status, filters.category_id, filters.department_id], () => { page.value = 1; load() })

function applyScan() {
  scanCode.value = filters.code || ''
  page.value = 1
  load()
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', category_id: null, subcategory_id: null, brand: '', model: '', serial_number: '', supplier_id: null, purchase_date: '', purchase_price: null, current_value: null, salvage_value: 0, useful_life: 5, warranty_expiry_date: '', status: 'available', condition: 'good', campus_id: null, faculty_id: null, department_id: null, building_id: null, floor_id: null, room_id: null, description: '' })
  dialogOpen.value = true
}

function openEdit(row) {
  editing.value = row
  Object.assign(form, {
    name: row.name, category_id: row.category_id, subcategory_id: row.subcategory_id,
    brand: row.brand, model: row.model, serial_number: row.serial_number,
    supplier_id: row.supplier_id, purchase_date: row.purchase_date, purchase_price: row.purchase_price,
    current_value: row.current_value, salvage_value: row.salvage_value, useful_life: row.useful_life,
    warranty_expiry_date: row.warranty_expiry_date, status: row.status, condition: row.condition,
    campus_id: row.campus_id, faculty_id: row.faculty_id, department_id: row.department_id,
    building_id: row.building_id, floor_id: row.floor_id, room_id: row.room_id, description: row.description,
  })
  dialogOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) await assetService.update(editing.value.id, { ...form })
    else await assetService.create({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: editing.value ? t('common.updatedSuccess') : t('common.createdSuccess') })
    await load()
  } catch (e) {
    const msg = e.errors ? Object.values(e.errors).flat().join(' · ') : e.message
    $q.notify({ type: 'negative', message: msg || t('common.saveFailed') })
  } finally {
    saving.value = false
  }
}

function openAssign(row) {
  assignTarget.value = row
  assignForm.assigned_to_user_id = null
  assignForm.expected_return_date = null
  assignForm.notes = ''
  assignOpen.value = true
}

async function doAssign() {
  assigning.value = true
  try {
    await assignmentService.assign(assignTarget.value.id, { ...assignForm })
    assignOpen.value = false
    $q.notify({ type: 'positive', message: t('assets.assignedSuccess') })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    assigning.value = false
  }
}

function confirmArchive(row) {
  $q.dialog({
    title: t('common.confirmArchiveTitle'),
    message: t('common.confirmArchiveMessage'),
    cancel: true, persistent: true, color: 'negative',
  }).onOk(async () => {
    try {
      await assetService.remove(row.id)
      $q.notify({ type: 'positive', message: t('common.archivedSuccess') })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    }
  })
}

onMounted(load)
</script>

<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Assets" subtitle="Inventory of all university assets" icon="inventory_2">
      <template #actions>
        <q-btn color="primary" icon="add" label="Add Asset" size="sm" v-if="canCreate" @click="openCreate" />
      </template>
    </AppPageHeader>

    <!-- Toolbar -->
    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" placeholder="Search code, name, serial…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="statusOptions" label="Status" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.category_id" :options="categoryOptions" label="Category" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.department_id" :options="departmentOptions" label="Department" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-input v-model="filters.code" dense outlined clearable placeholder="Scan code (barcode/QR)…" @keyup.enter="applyScan">
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
              <q-tooltip>View</q-tooltip>
            </q-btn>
            <q-btn v-if="canAssign && ['available', 'reserved'].includes(props.row.status)" flat dense round size="sm" color="info" icon="assignment_ind" @click="openAssign(props.row)">
              <q-tooltip>Assign</q-tooltip>
            </q-btn>
            <q-btn v-if="canEdit" flat dense round size="sm" color="primary" icon="edit" @click="openEdit(props.row)">
              <q-tooltip>Edit</q-tooltip>
            </q-btn>
            <q-btn v-if="canDelete" flat dense round size="sm" color="negative" icon="delete_outline" @click="confirmArchive(props.row)">
              <q-tooltip>Archive</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="inventory_2" title="No assets found" message="Try adjusting the filters or add a new asset." action-label="Add Asset" @action="openCreate" />
        </template>
      </q-table>

      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }} · Page {{ page }} of {{ lastPage }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <!-- Create / edit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card class="q-dialog-card" style="min-width: 480px; max-width: 860px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ editing ? 'Edit Asset' : 'Add Asset' }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="save" class="row q-col-gutter-md">
            <q-input v-model="form.name" label="Name *" dense outlined class="col-12" :rules="[required]"/>
            <q-select v-model="form.category_id" :options="categoryOptions" label="Category *" dense outlined emit-value map-options options-dense class="col-12 col-md-6" :rules="[required]"/>
            <q-select v-model="form.subcategory_id" :options="subcategoryOptions" label="Subcategory" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6"/>
            <q-input v-model="form.brand" label="Brand" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.model" label="Model" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.serial_number" label="Serial number" dense outlined class="col-6 col-md-3"/>
            <q-select v-model="form.supplier_id" :options="supplierOptions" label="Supplier" dense outlined emit-value map-options options-dense clearable class="col-6 col-md-3"/>
            <q-input v-model="form.purchase_date" label="Purchase date" type="date" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.purchase_price" label="Purchase price (AFN)" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.current_value" label="Current value (AFN)" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.salvage_value" label="Salvage value (AFN)" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.useful_life" label="Useful life (years)" type="number" dense outlined class="col-6 col-md-3"/>
            <q-input v-model="form.warranty_expiry_date" label="Warranty expiry" type="date" dense outlined class="col-6 col-md-3"/>
            <q-select v-model="form.status" :options="statusOptions" label="Status" dense outlined emit-value map-options options-dense class="col-6 col-md-3"/>
            <q-select v-model="form.condition" :options="conditionOptions" label="Condition" dense outlined emit-value map-options options-dense class="col-6 col-md-3"/>
            <q-select v-model="form.campus_id" :options="campusOptions" label="Campus" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.faculty_id" :options="facultyOptions" label="Faculty" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.department_id" :options="departmentOptions" label="Department" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.building_id" :options="buildingOptions" label="Building" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.floor_id" :options="floorOptions" label="Floor" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-select v-model="form.room_id" :options="roomOptions" label="Room" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-4"/>
            <q-input v-model="form.description" label="Description" type="textarea" dense outlined autogrow class="col-12"/>
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="dialogOpen = false"/>
              <q-btn label="Save" type="submit" color="primary" :loading="saving"/>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Assign dialog -->
    <q-dialog v-model="assignOpen" persistent>
      <q-card style="min-width: 380px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Assign asset</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="assignOpen = false"/>
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-sm">{{ assignTarget?.name }} · {{ assignTarget?.asset_code }}</div>
          <q-form @submit="doAssign" class="column q-gutter-md">
            <q-select v-model="assignForm.assigned_to_user_id" :options="userOptions" label="Assign to *" dense outlined emit-value map-options options-dense :rules="[required]"/>
            <q-input v-model="assignForm.expected_return_date" label="Expected return date" type="date" dense outlined/>
            <q-input v-model="assignForm.notes" label="Notes" type="textarea" dense outlined autogrow/>
            <div class="row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="assignOpen = false"/>
              <q-btn label="Assign" type="submit" color="primary" :loading="assigning"/>
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
import { assetService } from 'src/services/assets.service'
import { assignmentService } from 'src/services/operations.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { currency, date } from 'src/utils/format'

const $q = useQuasar()
const authStore = useAuthStore()
const { categories, subcategories, suppliers, campuses, faculties, departments, buildings, floors, rooms, users, opts } = useOptions()

const categoryOptions = computed(() => opts(categories.value))
const subcategoryOptions = computed(() => opts(subcategories.value))
const supplierOptions = computed(() => opts(suppliers.value))
const campusOptions = computed(() => opts(campuses.value))
const facultyOptions = computed(() => opts(faculties.value))
const departmentOptions = computed(() => opts(departments.value))
const buildingOptions = computed(() => opts(buildings.value))
const floorOptions = computed(() => opts(floors.value))
const roomOptions = computed(() => opts(rooms.value))
const userOptions = computed(() => opts(users.value))

const statusOptions = [
  { label: 'Available', value: 'available' }, { label: 'Assigned', value: 'assigned' },
  { label: 'Reserved', value: 'reserved' }, { label: 'Under Maintenance', value: 'under_maintenance' },
  { label: 'Damaged', value: 'damaged' }, { label: 'Lost', value: 'lost' },
  { label: 'Stolen', value: 'stolen' }, { label: 'Disposed', value: 'disposed' }, { label: 'Retired', value: 'retired' },
]
const conditionOptions = [
  { label: 'Excellent', value: 'excellent' }, { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' }, { label: 'Poor', value: 'poor' }, { label: 'Damaged', value: 'damaged' },
]

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
const required = (v) => (v !== null && v !== undefined && String(v).trim() !== '') || 'This field is required'

const canCreate = computed(() => authStore.hasPermission('assets.create'))
const canEdit = computed(() => authStore.hasPermission('assets.update'))
const canDelete = computed(() => authStore.hasPermission('assets.delete'))
const canAssign = computed(() => authStore.hasPermission('assets.assign'))

const columns = [
  { name: 'asset_code', label: 'Code', field: 'asset_code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'category_name', label: 'Category', field: 'category_name', align: 'left' },
  { name: 'purchase_price', label: 'Price', field: 'purchase_price', align: 'right', format: (v) => currency(v) },
  { name: 'current_value', label: 'Current', field: 'current_value', align: 'right', format: (v) => currency(v) },
  { name: 'department_name', label: 'Department', field: 'department_name', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'condition', label: 'Condition', field: 'condition', align: 'left' },
  { name: 'purchase_date', label: 'Purchased', field: 'purchase_date', align: 'left', format: (v) => date(v) },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]

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
    error.value = e.message || 'Failed to load assets.'
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
    $q.notify({ type: 'positive', message: editing.value ? 'Asset updated.' : 'Asset created.' })
    await load()
  } catch (e) {
    const msg = e.errors ? Object.values(e.errors).flat().join(' · ') : e.message
    $q.notify({ type: 'negative', message: msg || 'Save failed.' })
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
    $q.notify({ type: 'positive', message: 'Asset assigned.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    assigning.value = false
  }
}

function confirmArchive(row) {
  $q.dialog({
    title: 'Archive asset',
    message: `Archive “${row.name}”? Historical records are kept but the asset will disappear from lists.`,
    cancel: true, persistent: true, color: 'negative',
  }).onOk(async () => {
    try {
      await assetService.remove(row.id)
      $q.notify({ type: 'positive', message: 'Asset archived.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || 'Archive failed.' })
    }
  })
}

onMounted(load)
</script>

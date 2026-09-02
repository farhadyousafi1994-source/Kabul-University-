<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('hr.title')" :subtitle="t('hr.subtitle')" icon="badge" />

    <!-- Stat cards -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statTotal')" :value="stats.total" icon="group" color="primary" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statActive')" :value="stats.active" icon="check_circle" color="positive" :side="sideOf(stats.active, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statOnLeave')" :value="stats.on_leave" icon="beach_access" color="orange" :side="sideOf(stats.on_leave, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statInactive')" :value="stats.inactive" icon="do_not_disturb_on" color="grey-7" :side="sideOf(stats.inactive, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statWithAssets')" :value="stats.with_assets" icon="devices" color="teal" :side="sideOf(stats.with_assets, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statAssets')" :value="stats.assets" icon="inventory_2" color="secondary" />
      </div>
    </div>

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="exportColumns"
      :filename="'Employees_Report'"
      :title="t('hr.title')"
    />

    <!-- Toolbar: search + filters -->
    <div class="row items-center q-col-gutter-sm q-mb-sm print-hide">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" :placeholder="t('hr.searchPlaceholder')">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-3">
        <q-select v-model="filters.department_id" :options="departmentOptions" :label="t('hr.department')" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="statusOptions" :label="t('hr.status')" dense outlined clearable emit-value map-options options-dense />
      </div>
      <div class="col-6 col-md-3">
        <q-select v-model="filters.employment_type" :options="employmentTypeOptions" :label="t('hr.employmentType')" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <!-- Loading / error / table -->
    <div v-if="loading && !rows.length" class="q-mt-sm">
      <q-skeleton v-for="i in 6" :key="i" type="rect" height="48px" class="q-mb-sm" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <div v-else class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('hr.title') }}</div>
      <q-table
        :rows="rows"
        :columns="columns"
        row-key="id"
        flat
        bordered
        dense
        wrap-cells
        hide-bottom
        binary-state-sort
        v-model:pagination="tableSort"
        :loading="loading"
        :pagination="{ rowsPerPage: perPage }"
        :no-data-label="t('common.noData')"
        class="q-mt-sm data-table"
        @request="onSort"
      >
        <template #body-cell-full_name="props">
          <q-td :props="props" class="emp-name">
            <router-link :to="{ name: 'employee-detail', params: { id: props.row.id } }" class="row items-center no-wrap q-gutter-xs emp-name__link">
              <q-avatar size="30px" color="primary" text-color="white">
                <span class="text-weight-bold">{{ initials(props.row.full_name) }}</span>
              </q-avatar>
              <div class="col" style="min-width: 0">
                <div class="emp-name__t">{{ props.row.full_name }}</div>
                <div class="emp-name__s">{{ props.row.position || props.row.job_title || '—' }}</div>
              </div>
            </router-link>
          </q-td>
        </template>
        <template #body-cell-employment_type="props">
          <q-td :props="props">
            <q-badge :color="typeColor(props.row.employment_type)" outline>
              {{ typeLabel(props.row.employment_type) }}
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template #body-cell-assets_count="props">
          <q-td :props="props" class="text-center">
            <q-chip dense size="sm" :color="props.row.assets_count ? 'teal-1' : 'grey-2'" :text-color="props.row.assets_count ? 'teal-9' : 'grey-7'" icon="inventory_2">
              {{ props.row.assets_count }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat round dense size="sm" color="primary" icon="visibility" :to="{ name: 'employee-detail', params: { id: props.row.id } }">
              <q-tooltip>{{ t('common.view') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="canEdit" flat round dense size="sm" color="primary" icon="edit" @click="openEdit(props.row)">
              <q-tooltip>{{ t('common.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="canDelete"
              flat round dense size="sm" color="negative" icon="delete_outline"
              :loading="deletingId === props.row.id"
              :disable="Boolean(deletingId)"
              @click="pendingDelete = props.row"
            >
              <q-tooltip>{{ props.row.assets_count ? t('hr.deleteBlocked') : t('common.delete') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" #no-data>
          <EmptyState icon="badge" :title="t('hr.noEmployees')" :message="t('hr.noEmployeesDesc')" :action-label="canCreate ? t('hr.add') : ''" @action="openCreate" />
        </template>
      </q-table>

      <div class="row items-center justify-between q-mt-md q-gutter-sm print-hide">
        <div class="text-caption text-grey-6">
          {{ t('common.showingRecords', { count: rows.length, total, page, pages: Math.max(1, lastPage) }) }}
        </div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>

    <!-- Create / edit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 420px; max-width: 760px" class="q-dialog-card">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ editing ? t('hr.edit') : t('hr.add') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="save" class="row q-col-gutter-md">
            <div class="col-12 form-section">{{ t('hr.formSectionIdentity') }}</div>
            <div class="col-12 col-md-4">
              <q-input v-model="form.first_name" outlined dense :label="`${t('hr.firstName')} *`" :rules="[required]" :error="Boolean(fieldErrors.first_name)" :error-message="fieldErrors.first_name" />
            </div>
            <div class="col-12 col-md-4">
              <q-input v-model="form.last_name" outlined dense :label="`${t('hr.lastName')} *`" :rules="[required]" :error="Boolean(fieldErrors.last_name)" :error-message="fieldErrors.last_name" />
            </div>
            <div class="col-12 col-md-4">
              <q-input v-model="form.employee_code" outlined dense :label="t('hr.code')" :hint="editing ? '' : t('hr.codeHint')" :error="Boolean(fieldErrors.employee_code)" :error-message="fieldErrors.employee_code" />
            </div>

            <div class="col-12 form-section">{{ t('hr.formSectionJob') }}</div>
            <div class="col-12 col-md-6">
              <q-select v-model="form.department_id" :options="departmentOptions" :label="t('hr.department')" outlined dense emit-value map-options options-dense clearable />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="form.position" outlined dense :label="t('hr.position')" />
            </div>
            <div class="col-12 col-md-4">
              <q-select v-model="form.employment_type" :options="employmentTypeOptions" :label="`${t('hr.employmentType')} *`" outlined dense emit-value map-options options-dense :rules="[required]" />
            </div>
            <div class="col-12 col-md-4">
              <q-select v-model="form.status" :options="statusOptions" :label="`${t('hr.status')} *`" outlined dense emit-value map-options options-dense :rules="[required]" />
            </div>
            <div class="col-12 col-md-4">
              <q-input v-model="form.hire_date" outlined dense type="date" :label="t('hr.hireDate')" />
            </div>

            <div class="col-12 form-section">{{ t('hr.formSectionContact') }}</div>
            <div class="col-12 col-md-6">
              <q-input v-model="form.email" outlined dense type="email" :label="t('common.email')" :rules="[emailRule]" :error="Boolean(fieldErrors.email)" :error-message="fieldErrors.email" />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="form.phone" outlined dense :label="t('common.phone')" />
            </div>
            <div class="col-12">
              <q-input v-model="form.address" outlined dense :label="t('hr.address')" />
            </div>
            <div class="col-12">
              <q-input v-model="form.notes" outlined dense type="textarea" autogrow :label="t('hr.notes')" />
            </div>

            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" :disable="saving" @click="dialogOpen = false" />
              <q-btn :label="t('common.save')" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation -->
    <q-dialog v-model="deleteOpen" persistent>
      <q-card style="min-width: 340px; max-width: 460px">
        <q-card-section class="row items-center no-wrap" style="gap: 12px">
          <q-avatar icon="delete" color="negative" text-color="white" size="40px" />
          <div class="text-h6">{{ t('hr.deleteTitle') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          {{ t('hr.deleteMessage', { name: pendingDelete?.full_name || '' }) }}
          <div v-if="pendingDelete?.assets_count" class="text-negative text-caption q-mt-sm">
            <q-icon name="warning" size="16px" /> {{ t('hr.deleteBlocked') }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" :disable="Boolean(deletingId)" @click="pendingDelete = null" />
          <q-btn unelevated no-caps color="negative" icon="delete" :label="t('common.delete')"
            :loading="deletingId === pendingDelete?.id" @click="doDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import StatCard from 'src/components/common/StatCard.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { employeeService } from 'src/services/employees.service'
import { date as formatDate } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const { departments, opts } = useOptions()

const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(15)
const search = ref('')
const filters = reactive({ department_id: null, status: null, employment_type: null })
const sort = reactive({ by: 'full_name', descending: false })
const tableSort = ref({ sortBy: 'full_name', descending: false, rowsPerPage: 0 })
const loading = ref(false)
const error = ref('')

const stats = reactive({ total: 0, active: 0, inactive: 0, on_leave: 0, with_assets: 0, assets: 0 })

const dialogOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = reactive({})
const fieldErrors = reactive({})

const pendingDelete = ref(null)
const deletingId = ref(null)
const deleteOpen = computed({
  get: () => Boolean(pendingDelete.value),
  set: (v) => { if (!v) pendingDelete.value = null },
})

const canCreate = computed(() => authStore.hasPermission('employees.create'))
const canEdit = computed(() => authStore.hasPermission('employees.update'))
const canDelete = computed(() => authStore.hasPermission('employees.delete'))

const departmentOptions = computed(() => opts(departments.value))
const statusOptions = computed(() => [
  { label: t('hr.active'), value: 'active' },
  { label: t('hr.onLeave'), value: 'on_leave' },
  { label: t('hr.inactive'), value: 'inactive' },
])
const employmentTypeOptions = computed(() => [
  { label: t('hr.fullTime'), value: 'full_time' },
  { label: t('hr.partTime'), value: 'part_time' },
  { label: t('hr.contract'), value: 'contract' },
])

const typeLabel = (v) => ({ full_time: t('hr.fullTime'), part_time: t('hr.partTime'), contract: t('hr.contract') }[v] || v || '—')
const typeColor = (v) => ({ full_time: 'secondary', part_time: 'indigo', contract: 'deep-orange' }[v] || 'grey-7')
const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()
const sideOf = (n, totalN) => (totalN ? Math.round((n / totalN) * 100) : 0) + '%'
const required = (v) => (v !== null && v !== undefined && String(v).trim() !== '') || t('common.required')
const emailRule = (v) => !v || /^\S+@\S+\.\S+$/.test(String(v)) || t('common.invalidEmail')

const columns = computed(() => [
  { name: 'employee_code', label: t('hr.code'), field: 'employee_code', align: 'left', sortable: true, style: 'width: 110px' },
  { name: 'full_name', label: t('hr.fullName'), field: 'full_name', align: 'left', sortable: true },
  { name: 'department_name', label: t('hr.department'), field: 'department_name', align: 'left', sortable: true, format: (v) => v || '—' },
  { name: 'position', label: t('hr.position'), field: 'position', align: 'left', sortable: true, format: (v) => v || '—' },
  { name: 'phone', label: t('common.phone'), field: 'phone', align: 'left', format: (v) => v || '—' },
  { name: 'email', label: t('common.email'), field: 'email', align: 'left', format: (v) => v || '—' },
  { name: 'employment_type', label: t('hr.employmentType'), field: 'employment_type', align: 'left', sortable: true },
  { name: 'status', label: t('hr.status'), field: 'status', align: 'left', sortable: true },
  { name: 'assets_count', label: t('hr.assets'), field: 'assets_count', align: 'center', sortable: true },
  { name: 'actions', label: t('common.actions'), field: 'id', align: 'center', style: 'width: 130px' },
])

const exportColumns = computed(() => [
  { name: 'employee_code', label: t('hr.code'), field: 'employee_code' },
  { name: 'full_name', label: t('hr.fullName'), field: 'full_name' },
  { name: 'department_name', label: t('hr.department'), field: 'department_name' },
  { name: 'position', label: t('hr.position'), field: 'position' },
  { name: 'phone', label: t('common.phone'), field: 'phone' },
  { name: 'email', label: t('common.email'), field: 'email' },
  { name: 'employment_type', label: t('hr.employmentType'), field: 'employment_type', format: (v) => typeLabel(v) },
  { name: 'status', label: t('hr.status'), field: 'status', format: (v) => ({ active: t('hr.active'), inactive: t('hr.inactive'), on_leave: t('hr.onLeave') }[v] || v) },
  { name: 'hire_date', label: t('hr.hireDate'), field: 'hire_date', format: (v) => (v ? formatDate(v) : '—') },
  { name: 'assets_count', label: t('hr.assets'), field: 'assets_count' },
])

const barActions = computed(() => [
  { key: 'add', icon: 'add', label: t('hr.add'), color: 'teal', show: canCreate.value, handler: openCreate },
])

// ----- data loading ---------------------------------------------------------
async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value, sort: sort.by, direction: sort.descending ? 'desc' : 'asc' }
    if (search.value) params.search = search.value
    if (filters.department_id) params.department_id = filters.department_id
    if (filters.status) params.status = filters.status
    if (filters.employment_type) params.employment_type = filters.employment_type
    const { data } = await employeeService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const { data } = await employeeService.list({ per_page: 100 })
    const all = data?.data || []
    stats.total = data?.meta?.total ?? all.length
    stats.active = all.filter((e) => e.status === 'active').length
    stats.inactive = all.filter((e) => e.status === 'inactive').length
    stats.on_leave = all.filter((e) => e.status === 'on_leave').length
    stats.with_assets = all.filter((e) => e.assets_count > 0).length
    stats.assets = all.reduce((s, e) => s + (e.assets_count || 0), 0)
  } catch {
    /* stats are decorative — the table shows the real error state */
  }
}

function onSort(props) {
  const { sortBy, descending } = props.pagination
  sort.by = sortBy || 'full_name'
  sort.descending = Boolean(descending)
  tableSort.value = { sortBy: sort.by, descending: sort.descending, rowsPerPage: 0 }
  load()
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => [filters.department_id, filters.status, filters.employment_type], () => { page.value = 1; load() })

// ----- create / edit --------------------------------------------------------
function resetErrors() {
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
}

function openCreate() {
  editing.value = null
  resetErrors()
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, {
    first_name: '', last_name: '', employee_code: '', email: '', phone: '',
    department_id: null, position: '', employment_type: 'full_time',
    status: 'active', hire_date: '', address: '', notes: '',
  })
  dialogOpen.value = true
}

function openEdit(row) {
  editing.value = row
  resetErrors()
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, {
    first_name: row.first_name, last_name: row.last_name,
    employee_code: row.employee_code || '', email: row.email || '', phone: row.phone || '',
    department_id: row.department_id || null, position: row.position || '',
    employment_type: row.employment_type || 'full_time', status: row.status || 'active',
    hire_date: row.hire_date || '', address: row.address || '', notes: row.notes || '',
  })
  dialogOpen.value = true
}

async function save() {
  saving.value = true
  resetErrors()
  try {
    const payload = { ...form }
    if (!payload.employee_code) delete payload.employee_code
    if (editing.value) {
      await employeeService.update(editing.value.id, payload)
      $q.notify({ type: 'positive', message: t('common.updatedSuccess') })
    } else {
      await employeeService.create(payload)
      $q.notify({ type: 'positive', message: t('common.createdSuccess') })
    }
    dialogOpen.value = false
    await Promise.all([load(), loadStats()])
  } catch (e) {
    for (const [k, v] of Object.entries(e.errors || {})) {
      if (Array.isArray(v) && v.length) fieldErrors[k] = v[0]
    }
    const msg = e.errors ? Object.values(e.errors).flat().join(' · ') : e.message
    $q.notify({ type: 'negative', message: msg || t('common.saveFailed') })
  } finally {
    saving.value = false
  }
}

// ----- delete ---------------------------------------------------------------
async function doDelete() {
  const row = pendingDelete.value
  if (!row || deletingId.value) return
  deletingId.value = row.id
  try {
    await employeeService.remove(row.id)
    $q.notify({ type: 'positive', message: t('common.deletedSuccess') })
    pendingDelete.value = null
    await Promise.all([load(), loadStats()])
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  load()
  loadStats()
})
</script>

<style lang="sass" scoped>
.emp-name
  &__link
    text-decoration: none
    color: inherit
  &__t
    font-size: 13px
    font-weight: 600
    color: var(--q-primary)
  &__s
    font-size: 11px
    color: #757575

.form-section
  font-size: 12px
  font-weight: 700
  letter-spacing: .4px
  text-transform: uppercase
  color: var(--q-primary)
  border-bottom: 1px solid rgba(0, 0, 0, .08)
  padding-bottom: 4px
</style>

<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('hr.title')" :subtitle="t('hr.subtitle')" icon="badge" />

    <!-- Stat cards (reference: stat-card row with % side labels) -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statTotal')" :value="stats.total" icon="group" color="primary" :side="sideOf(stats.total, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statSalaries')" :value="formatCurrency(stats.payroll)" icon="payments" color="teal" small />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statActive')" :value="stats.active" icon="check_circle" color="positive" :side="sideOf(stats.active, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statLeave')" :value="stats.leave" icon="beach_access" color="orange" :side="sideOf(stats.leave, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statPermanent')" :value="stats.permanent" icon="workspace_premium" color="secondary" :side="sideOf(stats.permanent, stats.total)" />
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <StatCard :label="t('hr.statContract')" :value="stats.contract" icon="how_to_reg" color="deep-orange" :side="sideOf(stats.contract, stats.total)" />
      </div>
    </div>

    <!-- m-header (search + density toggle) -->
    <div class="m-header row items-center q-col-gutter-sm">
      <div class="col-12 col-md-5">
        <q-input v-model="search" dense outlined clearable debounce="300" :placeholder="t('hr.searchPlaceholder')">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-auto">
        <q-btn flat dense :icon="dense ? 'remove' : 'add'" color="grey-7" @click="dense = !dense">
          <q-tooltip>{{ t('common.showingRecords') }}</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="pagedRows"
      :columns="exportColumns"
      :filename="'employees'"
    />

    <!-- Department chips -->
    <div class="row q-col-gutter-x-sm q-mb-sm q-wrap print-hide">
      <q-chip
        v-for="d in deptChips"
        :key="d.id"
        dense
        outline
        :color="deptFilter === d.id ? 'primary' : 'grey-7'"
        :text-color="deptFilter === d.id ? 'white' : 'grey-7'"
        :icon="deptFilter === d.id ? 'check' : null"
        @click="deptFilter = deptFilter === d.id ? null : d.id"
      >
        {{ d.name }} ({{ d.count }})
      </q-chip>
    </div>

    <!-- Table -->
    <div v-if="loading" class="q-mt-sm">
      <q-skeleton v-for="i in 6" :key="i" type="rect" height="48px" class="q-mb-sm" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <div v-else class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('hr.title') }}</div>
      <q-table
        :rows="pagedRows"
        :columns="columns"
        row-key="id"
        flat
        bordered
        wrap-cells
        hide-bottom
        :dense="dense"
        :no-data-label="t('common.noData')"
        class="data-table"
      >
        <template #body-cell-select="props">
          <q-td :props="props" class="text-center">
            <q-checkbox
              :model-value="checked.has(props.row.id)"
              dense
              size="14px"
              color="primary"
              @update:model-value="(v) => toggleCheck(props.row.id, v)"
            />
          </q-td>
        </template>
        <template #body-cell-no="props">
          <q-td :props="props">{{ (page - 1) * perPage + props.index + 1 }}</q-td>
        </template>
        <template #body-cell-name="props">
          <q-td :props="props" class="emp-name">
            <div class="row items-center no-wrap q-gutter-xs">
              <q-avatar size="30px" color="primary" text-color="white">
                <span class="text-weight-bold">{{ initials(props.row.name) }}</span>
              </q-avatar>
              <div class="col" style="min-width: 0">
                <div class="emp-name__t">{{ props.row.name }}</div>
                <div class="emp-name__s">{{ props.row.email }}</div>
              </div>
            </div>
          </q-td>
        </template>
        <template #body-cell-salary="props">
          <q-td :props="props">{{ formatCurrency(props.row.salary) }}</q-td>
        </template>
        <template #body-cell-hire_type="props">
          <q-td :props="props">
            <q-badge :color="props.row.hire_type === 'permanent' ? 'secondary' : 'deep-orange'" outline>
              {{ t(`hr.${props.row.hire_type || 'permanent'}`) }}
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-status="props">
          <q-td :props="props">
            <StatusBadge :value="props.row.status" />
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat round dense size="sm" color="primary" icon="edit" :aria-label="t('common.edit')" @click="openEdit(props.row)">
              <q-tooltip>{{ t('common.edit') }}</q-tooltip>
            </q-btn>
            <q-btn flat round dense size="sm" color="teal" icon="badge" @click="idCardRow = props.row; idCardOpen = true">
              <q-tooltip>{{ t('hr.idCard') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="props.row.status === 'leave'"
              flat round dense size="sm" color="positive" icon="play_arrow"
              @click="setStatus(props.row, 'active')"
            >
              <q-tooltip>{{ t('status.active') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-else-if="props.row.status === 'active' && props.row.id !== authStore.user?.id"
              flat round dense size="sm" color="orange" icon="beach_access"
              @click="setStatus(props.row, 'leave')"
            >
              <q-tooltip>{{ t('hr.leave') }}</q-tooltip>
            </q-btn>
            <q-btn flat round dense size="sm" color="negative" icon="delete_outline" @click="confirmDelete(props.row)">
              <q-tooltip>{{ t('common.archive') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>

      <div class="row items-center justify-between q-mt-md q-gutter-sm print-hide">
        <div class="text-caption text-grey-6">
          {{ t('common.showingRecords', { count: pagedRows.length, total: filtered.length, page, pages: Math.max(1, lastPage) }) }}
        </div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>

    <!-- Create / edit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 420px; max-width: 720px" class="q-dialog-card">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ editing ? `${t('common.edit')} ${t('hr.entity')}` : t('hr.add') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="save" class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input v-model="form.name" outlined dense :label="t('hr.fullName') + ' *'" />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="form.employee_number" outlined dense :label="t('hr.code')" />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="form.email" outlined dense type="email" :label="t('common.email') + ' *'" />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="form.phone" outlined dense :label="t('common.phone')" />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="form.department_id"
                :options="opts(departments)"
                :label="t('hr.department')"
                outlined dense
                emit-value map-options
                :options-dense="true"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="form.position" outlined dense :label="t('hr.position')" />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="form.hire_type"
                :options="[{ label: t('hr.permanent'), value: 'permanent' }, { label: t('hr.contract'), value: 'contract' }]"
                :label="t('hr.hireType')"
                outlined dense
                emit-value map-options
                :options-dense="true"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model.number="form.salary" outlined dense type="number" :label="t('hr.salary') + ' (AFN)'" />
            </div>
            <template v-if="!editing">
              <div class="col-12 col-md-6">
                <q-input v-model="form.username" outlined dense :label="t('admin.users.username') + ' *'" />
              </div>
              <div class="col-12 col-md-6">
                <q-input v-model="form.password" outlined dense type="password" :label="t('auth.password') + ' *'" :hint="t('common.required')" />
              </div>
            </template>

            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn :label="t('common.save')" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Import CSV dialog -->
    <q-dialog v-model="importOpen" persistent>
      <q-card style="min-width: 420px; max-width: 640px" class="q-dialog-card">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('hr.importTitle') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="importOpen = false" />
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-sm">{{ t('hr.importText') }}</div>
          <q-input
            v-model="importText"
            type="textarea"
            filled
            autogrow
            min-rows="4"
            :placeholder="t('hr.importPlaceholder')"
          />
          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn :label="t('common.cancel')" flat color="grey-7" @click="importOpen = false" />
            <q-btn :label="t('hr.importButton')" color="primary" icon="database" :loading="importing" @click="runImport" />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Advanced search dialog -->
    <q-dialog v-model="advancedOpen">
      <q-card style="min-width: 380px; max-width: 520px" class="q-dialog-card">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('hr.advancedTitle') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="advancedOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form class="row q-col-gutter-md" @submit.prevent="applyAdvanced">
            <div class="col-12 col-md-6">
              <q-select
                v-model="adv.department_id"
                :options="opts(departments)"
                :label="t('hr.department')"
                outlined dense
                emit-value map-options clearable
                :options-dense="true"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="adv.hire_type"
                :options="[{ label: t('hr.permanent'), value: 'permanent' }, { label: t('hr.contract'), value: 'contract' }]"
                :label="t('hr.hireType')"
                outlined dense
                emit-value map-options clearable
                :options-dense="true"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="adv.status"
                :options="[{ label: t('hr.active'), value: 'active' }, { label: t('hr.leave'), value: 'leave' }, { label: t('hr.inactive'), value: 'inactive' }]"
                :label="t('hr.status')"
                outlined dense
                emit-value map-options clearable
                :options-dense="true"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model.number="adv.minSalary" outlined dense type="number" :label="t('hr.salary') + ' ≥ (AFN)'" />
            </div>
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.reset')" outline color="grey-7" type="button" @click="resetAdvanced" />
              <q-btn :label="t('common.search')" color="primary" type="submit" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- ID card dialog -->
    <q-dialog v-model="idCardOpen">
      <q-card class="q-dialog-card id-card-card" style="min-width: 360px; max-width: 460px">
        <div class="id-card print-area">
          <div class="id-card__bar">
            <div class="id-card__uni">
              <div class="id-card__uni-name">{{ t('common.universityName') }}</div>
              <div class="id-card__uni-sub">KU-AMS · {{ t('hr.idCard') }}</div>
            </div>
            <q-badge color="white" text-color="primary" outline>{{ idCardRow?.status?.toUpperCase() }}</q-badge>
          </div>
          <div class="row id-card__body items-center q-col-gutter-md">
            <q-avatar size="74px" color="primary" text-color="white" style="font-size: 26px" class="text-weight-bold">
              {{ initials(idCardRow?.name) }}
            </q-avatar>
            <div>
              <div class="id-card__name">{{ idCardRow?.name }}</div>
              <div class="id-card__pos">{{ idCardRow?.position || '—' }}</div>
              <div class="id-card__meta">{{ deptName(idCardRow?.department_id) }}</div>
            </div>
          </div>
          <div class="row id-card__grid no-wrap">
            <div class="col">
              <div class="id-card__k">{{ t('hr.code') }}</div>
              <div class="id-card__v">{{ idCardRow?.employee_number || '—' }}</div>
            </div>
            <div class="col">
              <div class="id-card__k">{{ t('common.phone') }}</div>
              <div class="id-card__v">{{ idCardRow?.phone || '—' }}</div>
            </div>
            <div class="col">
              <div class="id-card__k">{{ t('common.issuedAt') }}</div>
              <div class="id-card__v">{{ idCardRow?.created_at ? formatDate(idCardRow.created_at) : '—' }}</div>
            </div>
          </div>
        </div>
        <q-card-actions align="end" class="q-pa-sm">
          <q-btn :label="t('common.close')" flat color="grey-7" @click="idCardOpen = false" />
          <q-btn :label="t('hr.printIdCard')" color="primary" icon="print" @click="printArea('.id-card')" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import StatCard from 'src/components/common/StatCard.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { userService, userActions } from 'src/services/users.service'
import { currency as formatCurrency, date as formatDate } from 'src/utils/format'
import { printArea } from 'src/utils/export'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const { departments, opts } = useOptions()

const rows = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const dense = ref(false)
const page = ref(1)
const perPage = ref(10)
const checked = ref(new Set())

const dialogOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = reactive({})

const importOpen = ref(false)
const importText = ref('')
const importing = ref(false)

const advancedOpen = ref(false)
const adv = reactive({ department_id: null, hire_type: null, status: null, minSalary: null })
const deptFilter = ref(null)

const idCardOpen = ref(false)
const idCardRow = ref(null)

// ----- data loading ---------------------------------------------------------
async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await userService.list({ per_page: 100 })
    rows.value = data?.data || []
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

// ----- filtering / stats ------------------------------------------------------
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return rows.value.filter((u) => {
    if (q) {
      const hay = [u.name, u.email, u.phone, u.employee_number, u.position].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (deptFilter.value && u.department_id !== deptFilter.value) return false
    if (adv.department_id && u.department_id !== adv.department_id) return false
    if (adv.hire_type && u.hire_type !== adv.hire_type) return false
    if (adv.status && u.status !== adv.status) return false
    if (adv.minSalary && (u.salary || 0) < adv.minSalary) return false
    return true
  })
})

const stats = computed(() => {
  const s = { total: rows.value.length, active: 0, leave: 0, permanent: 0, contract: 0, payroll: 0 }
  for (const u of rows.value) {
    if (u.status === 'active') s.active++
    if (u.status === 'leave') s.leave++
    if (u.hire_type === 'permanent') s.permanent++
    else s.contract++
    s.payroll += Number(u.salary) || 0
  }
  return s
})

const lastPage = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage.value)))
const pagedRows = computed(() => filtered.value.slice((page.value - 1) * perPage.value, page.value * perPage.value))

const deptChips = computed(() => {
  const map = new Map()
  for (const u of rows.value) {
    if (!u.department_id) continue
    const name = deptName(u.department_id) || '—'
    map.set(u.department_id, { id: u.department_id, name, count: (map.get(u.department_id)?.count || 0) + 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

const deptName = (id) => (departments.value.find((d) => d.id === id) || {}).name || ''

const sideOf = (n, total) => (total ? Math.round((n / total) * 100) : 0) + '%'
const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()

// ----- export columns (shared action bar) --------------------------------------
const exportColumns = computed(() => [
  { name: 'employee_number', label: t('hr.code') },
  { name: 'name', label: t('hr.fullName') },
  { name: 'department', label: t('hr.department'), format: (v, r) => deptName(r.department_id) },
  { name: 'position', label: t('hr.position') },
  { name: 'hire_type', label: t('hr.hireType'), format: (v) => t(`hr.${v || 'permanent'}`) },
  { name: 'salary', label: t('hr.salary') },
  { name: 'status', label: t('hr.status'), format: (v) => t(`hr.${v || 'active'}`) },
])

const columns = [
  { name: 'select', required: true, header: '☑', align: 'center', style: 'width: 44px' },
  { name: 'no', label: '#', field: 'id', align: 'center', style: 'width: 40px' },
  { name: 'employee_number', label: t('hr.code'), field: 'employee_number', style: 'width: 100px' },
  { name: 'name', label: t('hr.fullName'), field: 'name' },
  { name: 'department', label: t('hr.department'), field: (r) => deptName(r.department_id), style: 'width: 160px' },
  { name: 'position', label: t('hr.position'), field: 'position', style: 'width: 150px' },
  { name: 'hire_type', label: t('hr.hireType'), field: 'hire_type', style: 'width: 110px' },
  { name: 'salary', label: t('hr.salary'), field: 'salary', align: 'end', style: 'width: 120px' },
  { name: 'status', label: t('hr.status'), field: 'status', style: 'width: 110px' },
  { name: 'actions', label: t('common.actions'), field: 'actions', align: 'center', style: 'width: 160px' },
]

const barActions = computed(() => [
  { key: 'add', icon: 'add', label: t('hr.add'), color: 'teal', handler: openCreate },
  { key: 'import', icon: 'database-import', mdi: true, label: t('common.import'), color: 'pink-6', handler: () => { importOpen.value = true } },
  { key: 'advanced', icon: 'tune', mdi: true, label: t('common.advancedSearch'), color: 'blue-grey-9', handler: () => { advancedOpen.value = true } },
])

// ----- selection --------------------------------------------------------------
function toggleCheck(id, on) {
  const next = new Set(checked.value)
  if (on) next.add(id)
  else next.delete(id)
  checked.value = next
}

// ----- create / edit ------------------------------------------------------------
function openCreate() {
  editing.value = null
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, {
    name: '', username: '', email: '', password: '', phone: '',
    employee_number: '', department_id: null, position: '', hire_type: 'permanent', salary: 0,
  })
  dialogOpen.value = true
}

function openEdit(row) {
  editing.value = row
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, {
    name: row.name, email: row.email, phone: row.phone || '',
    employee_number: row.employee_number || '',
    department_id: row.department_id || null,
    position: row.position || '',
    hire_type: row.hire_type || 'permanent',
    salary: row.salary || 0,
  })
  dialogOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await userService.update(editing.value.id, { ...form })
      $q.notify({ type: 'positive', message: t('common.updatedSuccess') })
    } else {
      await userService.create({ ...form })
      $q.notify({ type: 'positive', message: t('common.createdSuccess') })
    }
    dialogOpen.value = false
    await load()
  } catch (e) {
    const msg = e.errors ? Object.values(e.errors).flat().join(' · ') : e.message
    $q.notify({ type: 'negative', message: msg || t('common.saveFailed') })
  } finally {
    saving.value = false
  }
}

async function setStatus(row, status) {
  try {
    if (status === 'leave') await userActions.leave(row.id)
    else await userActions.activate(row.id)
    $q.notify({ type: 'positive', message: t('common.updatedSuccess') })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  }
}

function confirmDelete(row) {
  $q.dialog({
    title: t('common.confirmArchiveTitle'),
    message: t('common.confirmArchiveMessage'),
    cancel: true,
    persistent: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      await userService.remove(row.id)
      $q.notify({ type: 'positive', message: t('common.archivedSuccess') })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    }
  })
}

// ----- import ----------------------------------------------------------------
function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const split = (line) => {
    const out = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') quoted = false
        else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',' || ch === '\t') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }
  const first = split(lines[0]).map((h) => h.toLowerCase())
  const hasHeader = ['name', 'email', 'نوم', 'ایمیل', 'name (نام)'].some((h) => first.includes(h))
  const headers = hasHeader ? first : ['name', 'email', 'phone', 'department', 'role', 'salary']
  const dataLines = hasHeader ? lines.slice(1) : lines
  const deptNameToId = new Map(departments.value.map((d) => [d.name.toLowerCase(), d.id]))

  return dataLines.map((line) => {
    const cells = split(line)
    const rec = Object.fromEntries(headers.map((h, i) => [h, cells[i] || '']))
    const dept = String(rec.department || rec.dept || '').toLowerCase()
    return {
      name: rec.name,
      email: rec.email,
      phone: rec.phone || rec.phone_number || null,
      department_id: dept ? (deptNameToId.get(dept) || null) : null,
      position: rec.role || rec.position || null,
      hire_type: String(rec.hire_type || '').toLowerCase() === 'contract' ? 'contract' : 'permanent',
      salary: Number(String(rec.salary || '').replace(/[^\d.]/g, '')) || 0,
    }
  })
}

async function runImport() {
  const rows = parseCsv(importText.value)
  if (!rows.length) {
    $q.notify({ type: 'warning', message: t('hr.importError') })
    return
  }
  importing.value = true
  try {
    const { data } = await userActions.bulkImport(rows)
    const created = data?.created ?? 0
    importText.value = ''
    importOpen.value = false
    $q.notify({ type: created ? 'positive' : 'warning', message: t('hr.importDone', { count: created }) })
    if (created) await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('hr.importError') })
  } finally {
    importing.value = false
  }
}

// ----- advanced search ------------------------------------------------------------
function applyAdvanced() {
  deptFilter.value = adv.department_id
  advancedOpen.value = false
  page.value = 1
}

function resetAdvanced() {
  adv.department_id = null
  adv.hire_type = null
  adv.status = null
  adv.minSalary = null
  deptFilter.value = null
  page.value = 1
}

onMounted(load)
</script>

<style lang="sass" scoped>
.m-header
  margin-bottom: 6px

.emp-name
  &__t
    font-size: 13px
    font-weight: 600
  &__s
    font-size: 11px
    color: #757575

// ID card
.id-card
  border-radius: 14px
  overflow: hidden
  border: 1px solid rgba(0, 0, 0, .08)
  background: #fff

  &__bar
    display: flex
    align-items: center
    justify-content: space-between
    padding: 12px 16px
    color: #fff
    background: linear-gradient(115deg, var(--ku-header-from, $primary) 0%, var(--ku-header-to, $secondary) 100%)

  &__uni-name
    font-size: 14px
    font-weight: 700

  &__uni-sub
    font-size: 10.5px
    opacity: .85

  &__body
    padding: 16px

  &__name
    font-size: 18px
    font-weight: 700

  &__pos
    font-size: 12.5px
    color: var(--q-primary)
    font-weight: 600

  &__meta
    font-size: 11.5px
    color: #757575

  &__grid
    border-top: 1px dashed rgba(0, 0, 0, .15)
    padding: 10px 16px 14px

  &__k
    font-size: 10px
    color: #9e9e9e
    text-transform: uppercase
    letter-spacing: .4px

  &__v
    font-size: 12px
    font-weight: 600

:global(.body--dark)
  .id-card
    background: $dark-page
</style>

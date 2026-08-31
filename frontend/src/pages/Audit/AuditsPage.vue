<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Audits" subtitle="Physical audit campaigns with item-level verification" icon="fact_check">
      <template #actions>
        <q-btn v-if="canCreate" color="primary" icon="add" label="New Audit" size="sm" @click="dialogOpen = true" />
      </template>
    </AppPageHeader>

    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" placeholder="Search audit code…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="statusOptions" label="Status" dense outlined clearable emit-value map-options options-dense />
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
            <q-btn flat dense round size="sm" color="primary" icon="visibility" @click="openAudit(props.row)"><q-tooltip>Run / view</q-tooltip></q-btn>
            <q-btn v-if="canComplete && props.row.status === 'in_progress'" flat dense round size="sm" color="positive" icon="flag" @click="complete(props.row)"><q-tooltip>Complete</q-tooltip></q-btn>
            <q-btn v-if="canCreate && ['draft', 'scheduled', 'in_progress'].includes(props.row.status)" flat dense round size="sm" color="negative" icon="block" @click="cancel(props.row)"><q-tooltip>Cancel</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="fact_check" title="No audits" message="Create an audit to verify physical asset presence." />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <!-- New audit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 420px; max-width: 600px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">New audit</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.scope_type" :options="scopeOptions" label="Scope *" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model="form.scheduled_at" label="Scheduled date/time" type="date" dense outlined class="col-12 col-md-6" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn label="Create audit" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Audit run dialog -->
    <q-dialog v-model="runOpen" :maximized="$q.screen.lt.md" persistent>
      <q-card style="min-width: 520px; max-width: 960px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ current?.audit_code }} — Audit items</div>
          <q-space />
          <q-chip v-if="current" size="sm" color="primary" text-color="white">{{ summaryText }}</q-chip>
          <q-btn flat round dense icon="close" @click="runOpen = false" />
        </q-card-section>
        <q-card-section class="q-pt-sm">
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-input v-model="scan" dense outlined placeholder="Scan asset code…" class="col-12 col-md-5" @keyup.enter="verifyByCode" />
            <q-select v-model="verifyStatus" :options="verifyOptions" label="Mark as" dense outlined emit-value map-options options-dense class="col-5 col-md-3" />
            <q-btn color="primary" label="Verify" size="sm" :disable="!scan || !verifyStatus" @click="verifyByCode" />
          </div>
          <div v-if="!current?.items?.length" class="q-pa-md text-center text-grey-6">
            No items yet — start the audit to snapshot all assets.
          </div>
          <q-table v-else :rows="current.items" :columns="itemColumns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: 10 }">
            <template v-slot:body-cell-verification="props">
              <q-td :props="props">
                <q-btn-toggle
                  v-model="props.row.verification"
                  :options="verifyToggleOptions"
                  dense
                  size="sm"
                  spread
                  @update:model-value="verifyItem(props.row)"
                />
              </q-td>
            </template>
          </q-table>
        </q-card-section>
        <q-card-section class="row justify-end q-gutter-sm q-pt-none">
          <q-btn v-if="canCreate && current && ['draft', 'scheduled'].includes(current.status)" color="warning" label="Start audit" icon="play_arrow" @click="startAudit" />
          <q-btn v-if="canComplete && current?.status === 'in_progress'" color="positive" label="Complete audit" icon="flag" @click="complete(current)" />
          <q-btn v-if="canCreate && current && ['draft', 'scheduled', 'in_progress'].includes(current.status)" flat color="negative" label="Cancel audit" icon="block" @click="cancel(current)" />
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
import { auditService } from 'src/services/audit.service'
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
const runOpen = ref(false)
const current = ref(null)
const scan = ref('')
const verifyStatus = ref('found')
const form = reactive({ scope_type: 'all', scheduled_at: '' })
const filters = reactive({ status: null })

const statusOptions = [
  { label: 'Draft', value: 'draft' }, { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in_progress' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' },
]
const scopeOptions = [
  { label: 'All assets', value: 'all' }, { label: 'By department', value: 'department' }, { label: 'By category', value: 'category' },
]
const verifyOptions = [
  { label: 'Found', value: 'found' }, { label: 'Missing', value: 'missing' },
  { label: 'Damaged', value: 'damaged' }, { label: 'Pending', value: 'pending' },
]
const verifyToggleOptions = [
  { label: 'Pending', value: 'pending' }, { label: 'Found', value: 'found' },
  { label: 'Missing', value: 'missing' }, { label: 'Damaged', value: 'damaged' },
]
const required = (v) => !!v || 'This field is required'
const canCreate = computed(() => authStore.hasPermission('audit.create'))
const canComplete = computed(() => authStore.hasPermission('audit.complete'))

const columns = [
  { name: 'audit_code', label: 'Code', field: 'audit_code', align: 'left' },
  { name: 'scope_type', label: 'Scope', field: 'scope_type', align: 'left' },
  { name: 'auditor_name', label: 'Auditor', field: 'auditor_name', align: 'left' },
  { name: 'scheduled_at', label: 'Scheduled', field: 'scheduled_at', align: 'left', format: (v) => date(v) },
  { name: 'started_at', label: 'Started', field: 'started_at', align: 'left', format: (v) => date(v, true) },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]

const itemColumns = [
  { name: 'asset_code', label: 'Code', field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: 'Asset', field: 'asset_name', align: 'left' },
  { name: 'asset_status', label: 'Asset status', field: 'asset_status', align: 'left' },
  { name: 'scanned_at', label: 'Scanned', field: 'scanned_at', align: 'left', format: (v) => date(v, true) },
  { name: 'verification', label: 'Verification', field: 'verification', align: 'left' },
]

const summaryText = computed(() => {
  if (!current.value) return ''
  try {
    const s = JSON.parse(current.value.summary || '{}')
    return `${s.found || 0} found · ${s.missing || 0} missing · ${s.damaged || 0} damaged / ${s.total || current.value.items?.length || 0}`
  } catch {
    return `${current.value.items?.length || 0} items`
  }
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (filters.status) params.status = filters.status
    const { data } = await auditService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
  } catch (e) {
    error.value = e.message || 'Failed to load audits.'
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
    const { data } = await auditService.store({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: 'Audit created.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function openAudit(row) {
  try {
    const { data } = await auditService.get(row.id)
    current.value = data
    scan.value = ''
    verifyStatus.value = 'found'
    runOpen.value = true
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Failed to load audit.' })
  }
}

async function startAudit() {
  try {
    await auditService.start(current.value.id)
    $q.notify({ type: 'positive', message: 'Audit started — all assets snapshotted.' })
    await openAudit(current.value)
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  }
}

async function verifyByCode() {
  if (!scan.value || !verifyStatus.value) return
  const item = current.value?.items?.find((i) => [i.asset_code, String(i.asset_id)].includes(scan.value.trim())) || { asset_id: null }
  if (!item?.asset_id) {
    // Try a lookup: the mock verifies by asset_id, so search assets by code first.
    try {
      const { data: found } = await (await import('src/services/assets.service')).assetService.lookup(scan.value)
      item.asset_id = found.id
    } catch {
      $q.notify({ type: 'negative', message: 'Unknown asset code.' })
      return
    }
  }
  try {
    await auditService.verify(current.value.id, { asset_id: item.asset_id, verification: verifyStatus.value })
    scan.value = ''
    await openAudit(current.value)
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  }
}

async function verifyItem(item) {
  try {
    await auditService.verify(current.value.id, { asset_id: item.asset_id, verification: item.verification })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Verification failed.' })
    await openAudit(current.value)
  }
}

async function complete(audit) {
  $q.dialog({
    title: 'Complete audit',
    message: `Complete ${audit.audit_code}? Missing items stay flagged for follow-up.`,
    cancel: true, persistent: true,
  }).onOk(async () => {
    try {
      await auditService.complete(audit.id)
      runOpen.value = false
      $q.notify({ type: 'positive', message: 'Audit completed.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

async function cancel(audit) {
  $q.dialog({
    title: 'Cancel audit',
    message: `Cancel ${audit.audit_code}?`,
    cancel: true, persistent: true, color: 'negative',
  }).onOk(async () => {
    try {
      await auditService.cancel(audit.id)
      runOpen.value = false
      $q.notify({ type: 'positive', message: 'Audit cancelled.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

onMounted(load)
</script>

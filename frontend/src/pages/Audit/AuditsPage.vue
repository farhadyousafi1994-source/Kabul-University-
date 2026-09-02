<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('audit.title')" :subtitle="t('audit.subtitle')" icon="fact_check" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'Audits_Report'"
      :title="t('nav.items.audits')"
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
      <div class="print-title text-h6 q-mb-xs">{{ t('audit.title') }}</div>
      <q-table :rows="rows" :columns="columns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat dense round size="sm" color="primary" icon="visibility" @click="openAudit(props.row)"><q-tooltip>{{ t('common.details') }}</q-tooltip></q-btn>
            <q-btn v-if="canComplete && props.row.status === 'in_progress'" flat dense round size="sm" color="positive" icon="flag" @click="complete(props.row)"><q-tooltip>{{ t('maintenance.complete') }}</q-tooltip></q-btn>
            <q-btn v-if="canCreate && ['draft', 'scheduled', 'in_progress'].includes(props.row.status)" flat dense round size="sm" color="negative" icon="block" @click="cancel(props.row)"><q-tooltip>{{ t('common.cancel') }}</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="fact_check" :title="t('common.noData')" :message="t('common.noDataDesc')" />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>

    <!-- New audit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 420px; max-width: 600px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('audit.newAudit') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.scope_type" :options="scopeOptions" :label="`${t('common.category')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model="form.scheduled_at" :label="t('audit.auditDate')" type="date" dense outlined class="col-12 col-md-6" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn :label="t('common.create')" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Audit run dialog -->
    <q-dialog v-model="runOpen" :maximized="$q.screen.lt.md" persistent>
      <q-card style="min-width: 520px; max-width: 960px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ current?.audit_code }} — {{ t('audit.title') }}</div>
          <q-space />
          <q-chip v-if="current" size="sm" color="primary" text-color="white">{{ summaryText }}</q-chip>
          <q-btn flat round dense icon="close" @click="runOpen = false" />
        </q-card-section>
        <q-card-section class="q-pt-sm">
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-input v-model="scan" dense outlined :placeholder="t('assets.scanPlaceholder')" class="col-12 col-md-5" @keyup.enter="verifyByCode" />
            <q-select v-model="verifyStatus" :options="verifyOptions" :label="t('common.status')" dense outlined emit-value map-options options-dense class="col-5 col-md-3" />
            <q-btn color="primary" :label="t('common.save')" size="sm" :disable="!scan || !verifyStatus" @click="verifyByCode" />
          </div>
          <div v-if="!current?.items?.length" class="q-pa-md text-center text-grey-6">
            {{ t('common.noDataDesc') }}
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
          <q-btn v-if="canCreate && current && ['draft', 'scheduled'].includes(current.status)" color="warning" :label="t('common.start')" icon="play_arrow" @click="startAudit" />
          <q-btn v-if="canComplete && current?.status === 'in_progress'" color="positive" :label="t('maintenance.complete')" icon="flag" @click="complete(current)" />
          <q-btn v-if="canCreate && current && ['draft', 'scheduled', 'in_progress'].includes(current.status)" flat color="negative" :label="t('common.cancel')" icon="block" @click="cancel(current)" />
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
import { auditService } from 'src/services/audit.service'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('audit.newAudit'), color: 'teal', show: canCreate.value, handler: () => { dialogOpen.value = true }},
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
const runOpen = ref(false)
const current = ref(null)
const scan = ref('')
const verifyStatus = ref('found')
const form = reactive({ scope_type: 'all', scheduled_at: '' })
const filters = reactive({ status: null })

const statusOptions = computed(() => [
  { label: t('status.draft'), value: 'draft' },
  { label: t('status.scheduled'), value: 'scheduled' },
  { label: t('status.inProgress'), value: 'in_progress' },
  { label: t('status.completed'), value: 'completed' },
  { label: t('status.cancelled'), value: 'cancelled' },
])

const scopeOptions = computed(() => [
  { label: t('common.all'), value: 'all' },
  { label: t('organization.departments.entity'), value: 'department' },
  { label: t('catalog.categories.entity'), value: 'category' },
])

const verifyOptions = computed(() => [
  { label: t('audit.matchedItems'), value: 'found' },
  { label: t('audit.missingItems'), value: 'missing' },
  { label: t('status.damaged'), value: 'damaged' },
  { label: t('status.pending'), value: 'pending' },
])

const verifyToggleOptions = computed(() => [
  { label: t('status.pending'), value: 'pending' },
  { label: t('audit.matchedItems'), value: 'found' },
  { label: t('audit.missingItems'), value: 'missing' },
  { label: t('status.damaged'), value: 'damaged' },
])

const required = (v) => !!v || t('common.required')
const canCreate = computed(() => authStore.hasPermission('audit.create'))
const canComplete = computed(() => authStore.hasPermission('audit.complete'))

const columns = computed(() => [
  { name: 'audit_code', label: t('common.code'), field: 'audit_code', align: 'left' },
  { name: 'scope_type', label: t('common.category'), field: 'scope_type', align: 'left' },
  { name: 'auditor_name', label: t('audit.auditor'), field: 'auditor_name', align: 'left' },
  { name: 'scheduled_at', label: t('audit.auditDate'), field: 'scheduled_at', align: 'left', format: (v) => date(v) },
  { name: 'started_at', label: t('common.date'), field: 'started_at', align: 'left', format: (v) => date(v, true) },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

const itemColumns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'asset_status', label: t('common.status'), field: 'asset_status', align: 'left' },
  { name: 'scanned_at', label: t('common.date'), field: 'scanned_at', align: 'left', format: (v) => date(v, true) },
  { name: 'verification', label: t('common.status'), field: 'verification', align: 'left' },
])

const summaryText = computed(() => {
  if (!current.value) return ''
  try {
    const s = JSON.parse(current.value.summary || '{}')
    return `${s.found || 0} ${t('audit.matchedItems')} · ${s.missing || 0} ${t('audit.missingItems')} / ${s.total || current.value.items?.length || 0}`
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
    const { data } = await auditService.store({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: t('common.createdSuccess') })
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
    $q.notify({ type: 'negative', message: e.message || t('common.loadFailed') })
  }
}

async function startAudit() {
  try {
    await auditService.start(current.value.id)
    $q.notify({ type: 'positive', message: t('common.savedSuccess') })
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
    try {
      const { data: found } = await (await import('src/services/assets.service')).assetService.lookup(scan.value)
      item.asset_id = found.id
    } catch {
      $q.notify({ type: 'negative', message: t('assets.notFound') })
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
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    await openAudit(current.value)
  }
}

async function complete(audit) {
  $q.dialog({
    title: t('maintenance.complete'),
    message: `${t('maintenance.complete')}: ${audit.audit_code}?`,
    cancel: true, persistent: true,
  }).onOk(async () => {
    try {
      await auditService.complete(audit.id)
      runOpen.value = false
      $q.notify({ type: 'positive', message: t('common.savedSuccess') })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

async function cancel(audit) {
  $q.dialog({
    title: t('common.cancel'),
    message: `${t('common.cancel')}: ${audit.audit_code}?`,
    cancel: true, persistent: true, color: 'negative',
  }).onOk(async () => {
    try {
      await auditService.cancel(audit.id)
      runOpen.value = false
      $q.notify({ type: 'positive', message: t('common.savedSuccess') })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

onMounted(load)
</script>

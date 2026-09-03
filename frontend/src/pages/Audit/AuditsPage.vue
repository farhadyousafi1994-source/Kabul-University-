<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader
      :title="t('audit.title')" :subtitle="t('audit.subtitle')" icon="fact_check"
      :breadcrumbs="[{ label: t('nav.sections.operations') }, { label: t('audit.title') }]"
      :on-refresh="refreshAll"
      :refreshing="loading"
    />

    <StatisticsCards
      v-model:active="activeStatCard"
      module="audits"
      :filters="statisticsFilters"
      :refresh-key="statsRefreshKey"
      @filter="applyCardFilter"
    />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'Audits_Report'"
      :title="t('nav.items.audits')"
    />

    <div class="ku-toolbar row items-center q-col-gutter-sm print-hide">
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
      <q-table :rows="rows" :columns="columns" row-key="id" flat dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm data-table">
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
          <q-btn flat round dense icon="close" :disable="saving" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select
              v-model="form.scope_type"
              :options="scopeOptions"
              :label="`${t('common.category')} *`"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :rules="[required]"
              :disable="saving"
              :error="Boolean(fieldErrors.scope_type)"
              :error-message="fieldErrors.scope_type"
              class="col-12 col-md-6"
            />
            <q-input v-model="form.scheduled_at" :label="t('audit.auditDate')" type="date" dense outlined class="col-12 col-md-6" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" :disable="saving" @click="dialogOpen = false" />
              <q-btn
                :label="saving ? t('common.working') : t('common.create')"
                type="submit"
                color="primary"
                :loading="saving"
                data-cy="audit-submit"
              >
                <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('common.working') }}</template>
              </q-btn>
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
            <q-input v-model="scan" dense outlined :placeholder="t('assets.scanPlaceholder')" :disable="runBusy" class="col-12 col-md-5" @keyup.enter="verifyByCode" />
            <q-select v-model="verifyStatus" :options="verifyOptions" :label="t('common.status')" dense outlined emit-value map-options options-dense :disable="runBusy" class="col-5 col-md-3" />
            <q-btn
              color="primary"
              :label="runBusy ? t('common.working') : t('common.save')"
              size="sm"
              :loading="runBusy"
              :disable="!scan || !verifyStatus"
              data-cy="audit-verify"
              @click="verifyByCode"
            >
              <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('common.working') }}</template>
            </q-btn>
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
                  :disable="runBusy"
                  @update:model-value="verifyItem(props.row)"
                />
              </q-td>
            </template>
          </q-table>
        </q-card-section>
        <q-card-section class="row justify-end q-gutter-sm q-pt-none">
          <q-btn
            v-if="canCreate && current && ['draft', 'scheduled'].includes(current.status)"
            color="warning"
            :label="runBusy ? t('common.working') : t('common.start')"
            icon="play_arrow"
            :loading="runBusy"
            data-cy="audit-start"
            @click="startAudit"
          >
            <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('common.working') }}</template>
          </q-btn>
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
import StatisticsCards from 'src/components/common/StatisticsCards.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import { auditService } from 'src/services/audit.service'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'
import { notify } from 'src/utils/notify'
import { useAction } from 'src/composables/useAction'
import { confirmAction } from 'src/utils/confirm'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('audit.newAudit'), color: 'primary', show: canCreate.value, handler: () => { dialogOpen.value = true }},
])

const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const search = ref('')
const loading = ref(false)
const error = ref('')
/**
 * Shared action lifecycle: loading flag, duplicate-submission guard, specific
 * success toast, and server validation mapped onto `fieldErrors` so the dialog
 * can render it inline while staying open.
 */
const createAction = useAction()
/**
 * The audit-run dialog's inline actions (start / verify) share one lifecycle: a
 * duplicate-submission guard, the specific success toast, and server messages
 * surfaced through the standard error handling.
 */
const runAction = useAction()
const runBusy = runAction.pending

const saving = createAction.pending
const fieldErrors = createAction.fieldErrors
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

// --- summary cards ------------------------------------------------------------
// One aggregated request describes the SAME rows the table is showing, and a
// card click writes its filter straight into the page's filter state — so the
// cards, the filter controls and the table can never disagree.
const activeStatCard = ref('')
const statsRefreshKey = ref(0)

const statisticsFilters = computed(() => {
  const out = {}
  if (search.value) out.search = search.value
  for (const [k, v] of Object.entries(filters)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v
  }
  return out
})

function applyCardFilter(patch) {
  filters.status = patch?.status ?? null
  page.value = 1
  load()
}

/** Refresh: reload rows and statistics, keeping filters, search and sorting. */
async function refreshAll() {
  statsRefreshKey.value += 1
  await load()
}

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
watch(() => filters.status, (status) => {
  page.value = 1
  // A status chosen from the select must move (or clear) the highlighted card.
  if (!status) activeStatCard.value = ''
  load()
})

function resetForm() {
  Object.assign(form, { scope_type: 'all', scheduled_at: '' })
  createAction.clearFieldErrors()
}

function doCreate() {
  const entity = t('common.entities.audit')
  return createAction.run(() => auditService.store({ ...form }), {
    successMessage: t('common.createdSuccessEntity', { entity }),
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onSuccess: async () => {
      dialogOpen.value = false
      resetForm()
      await load()
    },
  })
}

async function openAudit(row) {
  try {
    const { data } = await auditService.get(row.id)
    current.value = data
    scan.value = ''
    verifyStatus.value = 'found'
    runOpen.value = true
  } catch (e) {
    notify.error(e.message || t('common.loadFailed'))
  }
}

function startAudit() {
  const target = current.value
  if (!target) return Promise.resolve({ ok: false, skipped: true })

  const entity = t('common.entities.audit')
  return runAction.run(() => auditService.start(target.id), {
    successMessage: t('common.savedSuccessEntity', { entity }),
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onSuccess: async () => {
      // Re-read the audit so the item checklist reflects the started state.
      await openAudit(target)
      await load()
    },
  })
}

async function verifyByCode() {
  if (!scan.value || !verifyStatus.value) return
  const item = current.value?.items?.find((i) => [i.asset_code, String(i.asset_id)].includes(scan.value.trim())) || { asset_id: null }
  if (!item?.asset_id) {
    try {
      const { data: found } = await (await import('src/services/assets.service')).assetService.lookup(scan.value)
      item.asset_id = found.id
    } catch {
      notify.error(t('assets.notFound'))
      return
    }
  }
  const auditId = current.value.id
  const verification = verifyStatus.value
  const entity = t('common.entities.audit')
  return runAction.run(
    () => auditService.verify(auditId, { asset_id: item.asset_id, verification }),
    {
      successMessage: t('common.savedSuccessEntity', { entity }),
      errorMessage: t('common.unableToSaveEntity', { entity }),
      onSuccess: async () => {
        scan.value = ''
        await openAudit(current.value)
      },
    },
  )
}

function verifyItem(item) {
  const auditId = current.value?.id
  if (!auditId) return Promise.resolve({ ok: false, skipped: true })

  const entity = t('common.entities.audit')
  return runAction.run(
    () => auditService.verify(auditId, { asset_id: item.asset_id, verification: item.verification }),
    {
      successMessage: t('common.savedSuccessEntity', { entity }),
      errorMessage: t('common.unableToSaveEntity', { entity }),
      // Re-read on failure too: the optimistic toggle must be rolled back to
      // whatever the server actually stored.
      onError: () => openAudit(current.value),
    },
  )
}

async function complete(audit) {
  const entity = t('common.entities.audit')
  const confirmed = await confirmAction({
    title: t('audit.completeTitle'),
    message: t('audit.completeMessage', { code: audit.audit_code }),
    okLabel: t('maintenance.complete'),
    busyLabel: t('common.updating'),
    icon: 'task_alt',
    color: 'positive',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => auditService.complete(audit.id),
  })
  if (!confirmed) return
  runOpen.value = false
  notify.success(t('common.savedSuccessEntity', { entity }))
  await load()
}

async function cancel(audit) {
  const entity = t('common.entities.audit')
  const confirmed = await confirmAction({
    title: t('audit.cancelTitle'),
    message: t('audit.cancelMessage', { code: audit.audit_code }),
    okLabel: t('audit.cancelAudit'),
    busyLabel: t('common.updating'),
    icon: 'cancel',
    color: 'negative',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => auditService.cancel(audit.id),
  })
  if (!confirmed) return
  runOpen.value = false
  notify.success(t('common.savedSuccessEntity', { entity }))
  await load()
}

onMounted(load)
</script>

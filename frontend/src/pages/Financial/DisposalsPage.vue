<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader
      :title="t('financial.disposals.title')" :subtitle="t('financial.disposals.subtitle')" icon="delete_forever"
      :breadcrumbs="[{ label: t('nav.sections.operations') }, { label: t('financial.disposals.title') }]"
      :on-refresh="refreshAll"
      :refreshing="loading"
    />

    <StatisticsCards
      v-model:active="activeStatCard"
      module="disposals"
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
      :filename="'Disposals_Report'"
      :title="t('nav.items.disposals')"
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
      <div class="print-title text-h6 q-mb-xs">{{ t('financial.disposals.title') }}</div>
      <q-table :rows="rows" :columns="columns" row-key="id" flat dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm data-table">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-revenue="props"><q-td :props="props">{{ currency(props.row.revenue) }}</q-td></template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn v-if="canDispose && props.row.status === 'pending_approval'" flat dense round size="sm" color="primary" icon="search" @click="inspect(props.row)"><q-tooltip>{{ t('common.details') }}</q-tooltip></q-btn>
            <q-btn v-if="canDispose && props.row.status === 'pending_approval'" flat dense round size="sm" color="positive" icon="check" @click="approve(props.row)"><q-tooltip>{{ t('requests.approve') }}</q-tooltip></q-btn>
            <q-btn v-if="canDispose && props.row.status === 'pending_approval'" flat dense round size="sm" color="negative" icon="block" @click="reject(props.row)"><q-tooltip>{{ t('requests.reject') }}</q-tooltip></q-btn>
            <q-btn v-if="canDispose && props.row.status === 'approved'" flat dense round size="sm" color="deep-orange" icon="delete_forever" @click="execute(props.row)"><q-tooltip>{{ t('financial.disposals.requestDisposal') }}</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="delete_forever" :title="t('common.noData')" :message="t('common.noDataDesc')" />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 440px; max-width: 600px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('financial.disposals.requestDisposal') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :disable="saving" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select
              v-model="form.asset_id"
              :options="assetOptions"
              :label="`${t('assignments.asset')} *`"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :rules="[required]"
              :disable="saving"
              :error="Boolean(fieldErrors.asset_id)"
              :error-message="fieldErrors.asset_id"
              class="col-12"
            />
            <q-select v-model="form.method" :options="methodOptions" :label="`${t('financial.disposals.method')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12 col-md-6" />
            <q-input v-model.number="form.revenue" :label="t('financial.disposals.salePrice')" type="number" dense outlined class="col-12 col-md-6" />
            <q-input v-model="form.notes" :label="t('common.notes')" type="textarea" dense outlined autogrow class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" :disable="saving" @click="dialogOpen = false" />
              <q-btn
                :label="saving ? t('common.submitting') : t('common.submit')"
                type="submit"
                color="negative"
                :loading="saving"
                data-cy="disposal-submit"
              >
                <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('common.submitting') }}</template>
              </q-btn>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import StatisticsCards from 'src/components/common/StatisticsCards.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import { disposalService } from 'src/services/financial.service'
import { assetService } from 'src/services/assets.service'
import { useAuthStore } from 'src/stores/auth'
import { currency, date } from 'src/utils/format'
import { notify } from 'src/utils/notify'
import { useAction } from 'src/composables/useAction'
import { confirmAction, promptAction } from 'src/utils/confirm'

const { t } = useI18n()
const authStore = useAuthStore()

const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('financial.disposals.requestDisposal'), color: 'red-7', show: canDispose.value, handler: () => { dialogOpen.value = true }},
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
const saving = createAction.pending
const fieldErrors = createAction.fieldErrors
const dialogOpen = ref(false)
const form = reactive({ asset_id: null, method: 'sold', revenue: 0, notes: '' })
const filters = reactive({ status: null })
const assetOptions = ref([])

const statusOptions = computed(() => [
  { label: t('status.pendingApproval'), value: 'pending_approval' },
  { label: t('status.approved'), value: 'approved' },
  { label: t('status.completed'), value: 'completed' },
  { label: t('status.rejected'), value: 'rejected' },
  { label: t('status.draft'), value: 'draft' },
])

const methodOptions = computed(() => [
  { label: t('financial.disposals.methods.sold'), value: 'sold' },
  { label: t('financial.disposals.methods.donated'), value: 'donated' },
  { label: t('financial.disposals.methods.recycled'), value: 'recycled' },
  { label: t('financial.disposals.methods.scrapped'), value: 'scrapped' },
  { label: t('financial.disposals.methods.destroyed'), value: 'destroyed' },
])

const required = (v) => !!v || t('common.required')
const canDispose = computed(() => authStore.hasPermission('assets.dispose'))

const columns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'method', label: t('financial.disposals.method'), field: 'method', align: 'left' },
  { name: 'requested_by_name', label: t('common.user'), field: 'requested_by_name', align: 'left' },
  { name: 'request_date', label: t('financial.disposals.disposalDate'), field: 'request_date', align: 'left', format: (v) => date(v) },
  { name: 'revenue', label: t('financial.disposals.salePrice'), field: 'revenue', align: 'right' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

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
    const { data } = await disposalService.list(params)
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

watch(dialogOpen, async (open) => {
  if (!open) return
  form.asset_id = null
  form.method = 'sold'
  form.revenue = 0
  form.notes = ''
  try {
    const { data } = await assetService.list({ per_page: 100 })
    assetOptions.value = (data?.data || []).filter((a) => !['disposed', 'retired'].includes(a.status))
      .map((a) => ({ label: `${a.asset_code} — ${a.name}`, value: a.id }))
  } catch { assetOptions.value = [] }
})

function resetForm() {
  Object.assign(form, { asset_id: null, method: 'sold', revenue: 0, notes: '' })
  createAction.clearFieldErrors()
}

function doCreate() {
  const entity = t('common.entities.disposal')
  return createAction.run(() => disposalService.store({ ...form }), {
    successMessage: t('common.createdSuccessEntity', { entity }),
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onSuccess: async () => {
      dialogOpen.value = false
      resetForm()
      await load()
    },
  })
}

/**
 * Inspection needs a note, so it uses the shared prompt dialog: the OK button
 * spins while the request runs and the dialog stays open (note preserved) if
 * the backend rejects it.
 */
async function inspect(row) {
  const entity = t('common.entities.disposal')
  const result = await promptAction({
    title: t('financial.disposals.inspectTitle'),
    message: t('financial.disposals.inspectMessage', { asset: row.asset_name }),
    okLabel: t('financial.disposals.inspect'),
    busyLabel: t('common.updating'),
    icon: 'fact_check',
    color: 'primary',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    fields: [
      {
        name: 'notes',
        label: t('common.notes'),
        type: 'textarea',
        value: row.notes || '',
        maxlength: 1000,
        placeholder: t('common.notesPlaceholder'),
      },
    ],
    onConfirm: ({ notes }) => disposalService.inspect(row.id, { notes }),
  })
  if (!result.ok) return
  notify.success(t('common.savedSuccessEntity', { entity }))
  await load()
}

async function approve(row) {
  const entity = t('common.entities.disposal')
  const confirmed = await confirmAction({
    title: t('financial.disposals.approveTitle'),
    message: t('financial.disposals.approveMessage', { asset: row.asset_name }),
    okLabel: t('requests.approve'),
    busyLabel: t('common.updating'),
    icon: 'thumb_up',
    color: 'positive',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => disposalService.approve(row.id),
  })
  if (!confirmed) return
  notify.success(t('common.savedSuccessEntity', { entity }))
  await load()
}

async function reject(row) {
  const entity = t('common.entities.disposal')
  const confirmed = await confirmAction({
    title: t('financial.disposals.rejectTitle'),
    message: t('financial.disposals.rejectMessage', { asset: row.asset_name }),
    okLabel: t('requests.reject'),
    busyLabel: t('common.updating'),
    icon: 'thumb_down',
    color: 'negative',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => disposalService.approve(row.id, false),
  })
  if (!confirmed) return
  notify.success(t('common.savedSuccessEntity', { entity }))
  await load()
}

async function execute(row) {
  const entity = t('common.entities.disposal')
  const confirmed = await confirmAction({
    title: t('financial.disposals.executeTitle'),
    message: t('financial.disposals.executeMessage', { asset: row.asset_name }),
    okLabel: t('financial.disposals.execute'),
    busyLabel: t('common.processing'),
    icon: 'delete_forever',
    color: 'deep-orange',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => disposalService.execute(row.id, {}),
  })
  if (!confirmed) return
  notify.success(t('common.savedSuccessEntity', { entity }))
  await load()
}

onMounted(load)
</script>

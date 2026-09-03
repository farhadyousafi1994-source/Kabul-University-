<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader
      :title="t('procurement.title')" :subtitle="t('procurement.subtitle')" icon="shopping_cart"
      :breadcrumbs="[{ label: t('nav.sections.operations') }, { label: t('procurement.title') }]"
      :on-refresh="refreshAll"
      :refreshing="loading"
    />

    <StatisticsCards
      v-model:active="activeStatCard"
      module="procurement"
      :filters="statisticsFilters"
      :refresh-key="statsRefreshKey"
      @filter="applyCardFilter"
    />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="tab === 'pr' ? prColumns : poColumns"
      :filename="'Procurement_Report'"
      :title="t('nav.items.procurement')"
    />

    <q-tabs v-model="tab" class="q-mb-md" dense>
      <q-tab name="pr" icon="request_quote" :label="t('procurement.newPurchaseRequest')" />
      <q-tab name="po" icon="receipt_long" :label="t('procurement.newPurchaseOrder')" />
    </q-tabs>

    <div class="ku-toolbar row items-center q-col-gutter-sm print-hide">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" :placeholder="tab === 'pr' ? `${t('common.search')} PR…` : `${t('common.search')} PO…`">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="tab === 'pr' ? prStatusOptions : poStatusOptions" :label="t('common.status')" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('procurement.title') }}</div>
      <q-table :rows="rows" :columns="tab === 'pr' ? prColumns : poColumns" row-key="id" flat dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm data-table">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <template v-if="tab === 'pr'">
              <q-btn v-if="canApprove && ['draft', 'requested'].includes(props.row.status)" flat dense round size="sm" color="positive" icon="approval" @click="openApprove(props.row)"><q-tooltip>{{ t('requests.approve') }}</q-tooltip></q-btn>
            </template>
            <template v-else>
              <q-btn flat dense round size="sm" color="primary" icon="visibility" @click="openPo(props.row)"><q-tooltip>{{ t('common.details') }}</q-tooltip></q-btn>
              <q-btn v-if="canUpdate && props.row.status === 'draft'" flat dense round size="sm" color="warning" icon="send" @click="send(props.row)"><q-tooltip>{{ t('common.submit') }}</q-tooltip></q-btn>
              <q-btn v-if="canUpdate && ['sent', 'partially_received'].includes(props.row.status)" flat dense round size="sm" color="positive" icon="inventory" @click="receive(props.row)"><q-tooltip>{{ t('status.completed') }}</q-tooltip></q-btn>
            </template>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState :icon="tab === 'pr' ? 'request_quote' : 'receipt_long'" :title="t('common.noData')" :message="t('common.noDataDesc')" />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>

    <!-- New PR dialog -->
    <q-dialog v-model="prOpen" persistent>
      <q-card style="min-width: 440px; max-width: 620px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('procurement.newPurchaseRequest') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :disable="saving" @click="prOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreatePr" class="row q-col-gutter-md">
            <q-select v-model="prForm.department_id" :options="departmentOptions" :label="t('organization.departments.entity')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="prForm.supplier_id" :options="supplierOptions" :label="t('catalog.suppliers.entity')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-input
              v-model="prForm.notes"
              :label="t('common.notes')"
              type="textarea"
              dense
              outlined
              autogrow
              :disable="saving"
              :error="Boolean(prAction.fieldErrors.notes)"
              :error-message="prAction.fieldErrors.notes"
              class="col-12"
            />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" :disable="saving" @click="prOpen = false" />
              <q-btn
                :label="saving ? t('common.working') : t('common.create')"
                type="submit"
                color="primary"
                :loading="saving"
                data-cy="pr-submit"
              >
                <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('common.working') }}</template>
              </q-btn>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Approve PR dialog with items -->
    <q-dialog v-model="approveOpen" persistent>
      <q-card style="min-width: 480px; max-width: 720px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('requests.approve') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :disable="approving" @click="approveOpen = false" />
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-sm">{{ approveTarget?.pr_number }}</div>
          <div v-for="(item, i) in approveForm.items" :key="i" class="row q-col-gutter-sm items-center q-mb-sm">
            <q-input v-model="item.name" :label="`${t('common.name')} *`" dense outlined class="col-12 col-md-4" :rules="[required]" />
            <q-select v-model="item.asset_category_id" :options="categoryOptions" :label="t('common.category')" dense outlined emit-value map-options options-dense clearable class="col-6 col-md-3" />
            <q-input v-model.number="item.quantity" :label="t('common.quantity')" type="number" dense outlined class="col-3 col-md-2" />
            <q-input v-model.number="item.unit_price" :label="t('financial.depreciation.originalCost')" type="number" dense outlined class="col-3 col-md-2" />
            <q-btn flat dense round color="negative" icon="delete_outline" @click="approveForm.items.splice(i, 1)" />
          </div>
          <q-btn flat dense size="sm" color="primary" icon="add" :label="t('common.create')" @click="approveForm.items.push({ name: '', asset_category_id: null, quantity: 1, unit_price: 0 })" />
          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn :label="t('common.cancel')" flat color="grey-7" :disable="approving" @click="approveOpen = false" />
            <q-btn
              :label="approving ? t('common.processing') : t('requests.approve')"
              color="positive"
              :loading="approving"
              data-cy="approve-submit"
              @click="doApprove"
            >
              <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('common.processing') }}</template>
            </q-btn>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- PO detail dialog -->
    <q-dialog v-model="poOpen" persistent>
      <q-card style="min-width: 520px; max-width: 800px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ poDetail?.po_number }} — {{ t('procurement.newPurchaseOrder') }}</div>
          <q-space />
          <q-chip v-if="poDetail" size="sm" color="primary" text-color="white">{{ poDetail.supplier_name || `Supplier #${poDetail.supplier_id}` }}</q-chip>
          <q-btn flat round dense icon="close" @click="poOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-table v-if="poDetail?.items?.length" :rows="poDetail.items" :columns="poItemColumns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: 10 }" />
          <EmptyState v-else icon="receipt_long" :title="t('common.noData')" :message="t('common.noDataDesc')" />
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
import { procurementService } from 'src/services/procurement.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'
import { notify } from 'src/utils/notify'
import { useAction } from 'src/composables/useAction'
import { confirmAction } from 'src/utils/confirm'

const { t } = useI18n()
const authStore = useAuthStore()
const { departments, suppliers, categories, opts } = useOptions()
const departmentOptions = computed(() => opts(departments.value))
const supplierOptions = computed(() => opts(suppliers.value))
const categoryOptions = computed(() => opts(categories.value))

const tab = ref('pr')
const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('procurement.newPurchaseRequest'), color: 'primary', show: canCreate.value, handler: openPr},
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
 * One action lifecycle per dialog, so the purchase-request form and the
 * approval form can never block or overwrite each other's state. Each gives us
 * the loading flag, the duplicate-submission guard, the specific success toast
 * and server validation mapped onto `fieldErrors`.
 */
const prAction = useAction()
const approveAction = useAction()
const saving = prAction.pending
const approving = approveAction.pending
const prOpen = ref(false)
const approveOpen = ref(false)
const poOpen = ref(false)
const approveTarget = ref(null)
const poDetail = ref(null)
const prForm = reactive({ department_id: null, supplier_id: null, notes: '' })
const approveForm = reactive({ items: [] })
const filters = reactive({ status: null })

const prStatusOptions = computed(() => [
  { label: t('status.draft'), value: 'draft' },
  { label: t('status.requested'), value: 'requested' },
  { label: t('status.approved'), value: 'approved' },
  { label: t('status.rejected'), value: 'rejected' },
  { label: t('procurement.poNumber'), value: 'purchase_order' },
  { label: t('status.cancelled'), value: 'cancelled' },
])

const poStatusOptions = computed(() => [
  { label: t('status.draft'), value: 'draft' },
  { label: t('status.sent'), value: 'sent' },
  { label: t('status.partiallyReceived'), value: 'partially_received' },
  { label: t('status.received'), value: 'received' },
  { label: t('status.cancelled'), value: 'cancelled' },
])

const required = (v) => !!v || t('common.required')
const canCreate = computed(() => authStore.hasPermission('procurement.create'))
const canUpdate = computed(() => authStore.hasPermission('procurement.update'))
const canApprove = computed(() => authStore.hasPermission('procurement.approve'))

const prColumns = computed(() => [
  { name: 'pr_number', label: t('common.code'), field: 'pr_number', align: 'left' },
  { name: 'requested_by_name', label: t('common.user'), field: 'requested_by_name', align: 'left' },
  { name: 'supplier_name', label: t('catalog.suppliers.entity'), field: 'supplier_name', align: 'left' },
  { name: 'created_at', label: t('common.date'), field: 'created_at', align: 'left', format: (v) => date(v) },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

const poColumns = computed(() => [
  { name: 'po_number', label: t('procurement.poNumber'), field: 'po_number', align: 'left' },
  { name: 'supplier_name', label: t('catalog.suppliers.entity'), field: 'supplier_name', align: 'left' },
  { name: 'order_date', label: t('common.date'), field: 'order_date', align: 'left', format: (v) => date(v) },
  { name: 'expected_date', label: t('procurement.expectedDelivery'), field: 'expected_date', align: 'left', format: (v) => date(v) },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

const poItemColumns = computed(() => [
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'brand', label: t('assets.brand'), field: 'brand', align: 'left' },
  { name: 'model', label: t('assets.model'), field: 'model', align: 'left' },
  { name: 'quantity', label: t('common.quantity'), field: 'quantity', align: 'right' },
  { name: 'received_quantity', label: t('status.received'), field: 'received_quantity', align: 'right' },
  { name: 'unit_price', label: t('financial.depreciation.originalCost'), field: 'unit_price', align: 'right' },
])

// --- summary cards ------------------------------------------------------------
const activeStatCard = ref('')
const statsRefreshKey = ref(0)

const statisticsFilters = computed(() => {
  const out = {}
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

/** Refresh: reload the table and the summary cards, keeping the current view. */
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
    const { data } = await (tab.value === 'pr' ? procurementService.purchaseRequests(params) : procurementService.purchaseOrders(params))
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
watch(tab, () => { page.value = 1; filters.status = null; load() })

function openPr() {
  prForm.department_id = null
  prForm.supplier_id = null
  prForm.notes = ''
  prOpen.value = true
}

function resetPrForm() {
  Object.assign(prForm, { department_id: null, supplier_id: null, notes: '' })
  prAction.clearFieldErrors()
}

function doCreatePr() {
  const entity = t('common.entities.purchaseRequest')
  return prAction.run(() => procurementService.createPurchaseRequest({ ...prForm }), {
    successMessage: t('common.createdSuccessEntity', { entity }),
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onSuccess: async () => {
      prOpen.value = false
      resetPrForm()
      await load()
    },
  })
}

function openApprove(row) {
  approveTarget.value = row
  approveForm.items = [{ name: '', asset_category_id: null, quantity: 1, unit_price: 0 }]
  approveOpen.value = true
}

function doApprove() {
  const target = approveTarget.value
  if (!target) return Promise.resolve({ ok: false, skipped: true })

  const entity = t('common.entities.purchaseRequest')
  return approveAction.run(
    () => procurementService.approvePurchaseRequest(target.id, { items: approveForm.items }),
    {
      successMessage: t('common.savedSuccessEntity', { entity }),
      errorMessage: t('common.unableToSaveEntity', { entity }),
      onSuccess: async () => {
        approveOpen.value = false
        approveTarget.value = null
        await load()
      },
    },
  )
}

async function openPo(row) {
  try {
    const { data } = await procurementService.purchaseOrder(row.id)
    poDetail.value = data
    poOpen.value = true
  } catch (e) {
    notify.error(e.message || t('common.loadFailed'))
  }
}

async function send(row) {
  const entity = t('common.entities.purchaseOrder')
  const confirmed = await confirmAction({
    title: t('procurement.sendTitle'),
    message: t('procurement.sendMessage', { number: row.po_number }),
    okLabel: t('procurement.send'),
    busyLabel: t('common.submitting'),
    icon: 'send',
    color: 'primary',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => procurementService.sendOrder(row.id),
  })
  if (!confirmed) return
  notify.success(t('common.submittedSuccessEntity', { entity }))
  await load()
}

async function receive(row) {
  const entity = t('common.entities.purchaseOrder')
  const confirmed = await confirmAction({
    title: t('procurement.receiveTitle'),
    message: t('procurement.receiveMessage', { number: row.po_number }),
    okLabel: t('procurement.receive'),
    busyLabel: t('common.updating'),
    icon: 'inventory',
    color: 'positive',
    errorMessage: t('common.unableToSaveEntity', { entity }),
    onConfirm: () => procurementService.receive(row.id, {}),
  })
  if (!confirmed) return
  notify.success(t('common.savedSuccessEntity', { entity }))
  await load()
}

onMounted(load)
</script>

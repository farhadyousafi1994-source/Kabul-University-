<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader title="Procurement" subtitle="Purchase requests and orders" icon="shopping_cart">
      <template #actions>
        <q-btn v-if="canCreate" color="primary" icon="add" label="New Purchase Request" size="sm" @click="openPr" />
      </template>
    </AppPageHeader>

    <q-tabs v-model="tab" class="q-mb-md" dense>
      <q-tab name="pr" icon="request_quote" label="Purchase Requests" />
      <q-tab name="po" icon="receipt_long" label="Purchase Orders" />
    </q-tabs>

    <div class="row items-center q-col-gutter-sm q-mb-sm">
      <div class="col-12 col-md-4">
        <q-input v-model="search" dense outlined clearable debounce="350" :placeholder="tab === 'pr' ? 'Search PR number…' : 'Search PO number…'">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select v-model="filters.status" :options="tab === 'pr' ? prStatusOptions : poStatusOptions" label="Status" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <q-table :rows="rows" :columns="tab === 'pr' ? prColumns : poColumns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <template v-if="tab === 'pr'">
              <q-btn v-if="canApprove && ['draft', 'requested'].includes(props.row.status)" flat dense round size="sm" color="positive" icon="approval" @click="openApprove(props.row)"><q-tooltip>Approve → PO</q-tooltip></q-btn>
            </template>
            <template v-else>
              <q-btn flat dense round size="sm" color="primary" icon="visibility" @click="openPo(props.row)"><q-tooltip>View</q-tooltip></q-btn>
              <q-btn v-if="canUpdate && props.row.status === 'draft'" flat dense round size="sm" color="warning" icon="send" @click="send(props.row)"><q-tooltip>Send to supplier</q-tooltip></q-btn>
              <q-btn v-if="canUpdate && ['sent', 'partially_received'].includes(props.row.status)" flat dense round size="sm" color="positive" icon="inventory" @click="receive(props.row)"><q-tooltip>Receive goods</q-tooltip></q-btn>
            </template>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState :icon="tab === 'pr' ? 'request_quote' : 'receipt_long'" :title="tab === 'pr' ? 'No purchase requests' : 'No purchase orders'" message="Procurement turns requests into received assets." />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md">
        <div class="text-caption text-grey-6">Showing {{ rows.length }} of {{ total }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </template>

    <!-- New PR dialog -->
    <q-dialog v-model="prOpen" persistent>
      <q-card style="min-width: 440px; max-width: 620px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">New purchase request</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="prOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreatePr" class="row q-col-gutter-md">
            <q-select v-model="prForm.department_id" :options="departmentOptions" label="Department" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="prForm.supplier_id" :options="supplierOptions" label="Supplier" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-input v-model="prForm.notes" label="Notes" type="textarea" dense outlined autogrow class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn label="Cancel" flat color="grey-7" @click="prOpen = false" />
              <q-btn label="Create" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Approve PR dialog with items -->
    <q-dialog v-model="approveOpen" persistent>
      <q-card style="min-width: 480px; max-width: 720px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Approve & convert to PO</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="approveOpen = false" />
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-sm">{{ approveTarget?.pr_number }} — add the line items to order.</div>
          <div v-for="(item, i) in approveForm.items" :key="i" class="row q-col-gutter-sm items-center q-mb-sm">
            <q-input v-model="item.name" label="Item name *" dense outlined class="col-12 col-md-4" :rules="[required]" />
            <q-select v-model="item.asset_category_id" :options="categoryOptions" label="Category" dense outlined emit-value map-options options-dense clearable class="col-6 col-md-3" />
            <q-input v-model.number="item.quantity" label="Qty" type="number" dense outlined class="col-3 col-md-2" />
            <q-input v-model.number="item.unit_price" label="Unit price" type="number" dense outlined class="col-3 col-md-2" />
            <q-btn flat dense round color="negative" icon="delete_outline" @click="approveForm.items.splice(i, 1)" />
          </div>
          <q-btn flat dense size="sm" color="primary" icon="add" label="Add item" @click="approveForm.items.push({ name: '', asset_category_id: null, quantity: 1, unit_price: 0 })" />
          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn label="Cancel" flat color="grey-7" @click="approveOpen = false" />
            <q-btn label="Approve & create PO" color="positive" :loading="saving" @click="doApprove" />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- PO detail dialog -->
    <q-dialog v-model="poOpen" persistent>
      <q-card style="min-width: 520px; max-width: 800px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ poDetail?.po_number }} — Purchase order</div>
          <q-space />
          <q-chip v-if="poDetail" size="sm" color="primary" text-color="white">{{ poDetail.supplier_name || `Supplier #${poDetail.supplier_id}` }}</q-chip>
          <q-btn flat round dense icon="close" @click="poOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-table v-if="poDetail?.items?.length" :rows="poDetail.items" :columns="poItemColumns" row-key="id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: 10 }" />
          <EmptyState v-else icon="receipt_long" title="No items" message="This order has no line items yet." />
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
import { procurementService } from 'src/services/procurement.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const $q = useQuasar()
const authStore = useAuthStore()
const { departments, suppliers, categories, opts } = useOptions()
const departmentOptions = computed(() => opts(departments.value))
const supplierOptions = computed(() => opts(suppliers.value))
const categoryOptions = computed(() => opts(categories.value))

const tab = ref('pr')
const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const search = ref('')
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const prOpen = ref(false)
const approveOpen = ref(false)
const poOpen = ref(false)
const approveTarget = ref(null)
const poDetail = ref(null)
const prForm = reactive({ department_id: null, supplier_id: null, notes: '' })
const approveForm = reactive({ items: [] })
const filters = reactive({ status: null })

const prStatusOptions = [
  { label: 'Draft', value: 'draft' }, { label: 'Requested', value: 'requested' },
  { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' },
  { label: 'Purchase Order', value: 'purchase_order' }, { label: 'Cancelled', value: 'cancelled' },
]
const poStatusOptions = [
  { label: 'Draft', value: 'draft' }, { label: 'Sent', value: 'sent' },
  { label: 'Partially Received', value: 'partially_received' }, { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
]
const required = (v) => !!v || 'This field is required'
const canCreate = computed(() => authStore.hasPermission('procurement.create'))
const canUpdate = computed(() => authStore.hasPermission('procurement.update'))
const canApprove = computed(() => authStore.hasPermission('procurement.approve'))

const prColumns = [
  { name: 'pr_number', label: 'Number', field: 'pr_number', align: 'left' },
  { name: 'requested_by_name', label: 'Requested by', field: 'requested_by_name', align: 'left' },
  { name: 'supplier_name', label: 'Supplier', field: 'supplier_name', align: 'left' },
  { name: 'created_at', label: 'Created', field: 'created_at', align: 'left', format: (v) => date(v) },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]

const poColumns = [
  { name: 'po_number', label: 'Number', field: 'po_number', align: 'left' },
  { name: 'supplier_name', label: 'Supplier', field: 'supplier_name', align: 'left' },
  { name: 'order_date', label: 'Ordered', field: 'order_date', align: 'left', format: (v) => date(v) },
  { name: 'expected_date', label: 'Expected', field: 'expected_date', align: 'left', format: (v) => date(v) },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]

const poItemColumns = [
  { name: 'name', label: 'Item', field: 'name', align: 'left' },
  { name: 'brand', label: 'Brand', field: 'brand', align: 'left' },
  { name: 'model', label: 'Model', field: 'model', align: 'left' },
  { name: 'quantity', label: 'Qty', field: 'quantity', align: 'right' },
  { name: 'received_quantity', label: 'Received', field: 'received_quantity', align: 'right' },
  { name: 'unit_price', label: 'Unit price', field: 'unit_price', align: 'right' },
]

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
    error.value = e.message || 'Failed to load procurement data.'
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

async function doCreatePr() {
  saving.value = true
  try {
    await procurementService.createPurchaseRequest({ ...prForm })
    prOpen.value = false
    $q.notify({ type: 'positive', message: 'Purchase request created.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

function openApprove(row) {
  approveTarget.value = row
  approveForm.items = [{ name: '', asset_category_id: null, quantity: 1, unit_price: 0 }]
  approveOpen.value = true
}

async function doApprove() {
  saving.value = true
  try {
    await procurementService.approvePurchaseRequest(approveTarget.value.id, { items: approveForm.items })
    approveOpen.value = false
    $q.notify({ type: 'positive', message: 'Approved — purchase order created.' })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function openPo(row) {
  try {
    const { data } = await procurementService.purchaseOrder(row.id)
    poDetail.value = data
    poOpen.value = true
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Failed to load order.' })
  }
}

async function send(row) {
  $q.dialog({ title: 'Send order', message: `Send ${row.po_number} to ${row.supplier_name || 'the supplier'}?`, cancel: true, persistent: true })
    .onOk(async () => {
      try {
        await procurementService.sendOrder(row.id)
        $q.notify({ type: 'positive', message: 'Order sent.' })
        await load()
      } catch (e) {
        $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
      }
    })
}

async function receive(row) {
  $q.dialog({
    title: 'Receive goods',
    message: `Mark ${row.po_number} as received? Asset records will be created from the line items.`,
    cancel: true, persistent: true,
  }).onOk(async () => {
    try {
      await procurementService.receive(row.id, {})
      $q.notify({ type: 'positive', message: 'Goods received — assets created.' })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
    }
  })
}

onMounted(load)
</script>

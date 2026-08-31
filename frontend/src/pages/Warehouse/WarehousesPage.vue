<template>
  <DataTablePage
    title="Warehouses"
    subtitle="Storage locations for stock"
    icon="warehouse"
    entity-label="warehouse"
    :load="warehouseService.list"
    :columns="columns"
    perms="warehouse"
    search-placeholder="Search by code, name or location…"
    create-label="Add Warehouse"
    empty-title="No warehouses yet"
    empty-message="Warehouses track where stock is stored."
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  >
    <template #rowActions="{ row }">
      <q-btn flat dense round size="sm" color="info" icon="inventory" @click="openStock(row)">
        <q-tooltip>View stock</q-tooltip>
      </q-btn>
    </template>
  </DataTablePage>

  <q-dialog v-model="stockOpen" persistent>
    <q-card style="min-width: 480px; max-width: 720px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ stockWh?.name }} — Stock</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="stockOpen = false" />
      </q-card-section>
      <q-card-section>
        <div v-if="stockLoading" class="q-gutter-sm">
          <q-skeleton type="rect" height="40px" v-for="i in 3" :key="i" />
        </div>
        <q-table v-else :rows="stockRows" :columns="stockColumns" row-key="asset_id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: 10 }">
          <template v-if="!stockRows.length" v-slot:no-data>
            <EmptyState icon="inventory" title="Empty warehouse" message="Record stock-in transactions to fill this warehouse." />
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { warehouseService, warehouseActions } from 'src/services/warehouse.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'
import EmptyState from 'src/components/common/EmptyState.vue'

const stockOpen = ref(false)
const stockLoading = ref(false)
const stockWh = ref(null)
const stockRows = ref([])

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'location', label: 'Location', field: 'location', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
]

const stockColumns = [
  { name: 'asset_code', label: 'Code', field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: 'Asset', field: 'asset_name', align: 'left' },
  { name: 'stock_qty', label: 'In stock', field: 'stock_qty', align: 'right' },
  { name: 'out_qty', label: 'Shipped out', field: 'out_qty', align: 'right' },
]

const form = {
  fields: [
    { key: 'code', label: 'Code', type: 'text', required: true, hint: 'e.g. WH-1' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}

const submit = async (values, editing) => (editing ? warehouseService.update(editing.id, values) : warehouseService.create(values))
const destroy = (row) => warehouseService.remove(row.id)

async function openStock(row) {
  stockWh.value = row
  stockOpen.value = true
  stockLoading.value = true
  try {
    const { data } = await warehouseActions.stock(row.id)
    stockRows.value = data?.data || []
  } catch {
    stockRows.value = []
  } finally {
    stockLoading.value = false
  }
}
</script>

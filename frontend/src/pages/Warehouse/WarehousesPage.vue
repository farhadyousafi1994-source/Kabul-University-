<template>
  <DataTablePage
    :title="t('warehouse.warehouses.title')"
    :subtitle="t('warehouse.warehouses.subtitle')"
    icon="warehouse"
    :entity-label="t('warehouse.warehouses.entity')"
    :load="warehouseService.list"
    :columns="columns"
    perms="warehouse"
    :search-placeholder="`${t('common.search')}…`"
    :create-label="t('warehouse.warehouses.add')"
    :empty-title="t('common.nothingHere')"
    :empty-message="t('common.noDataDesc')"
    :create-form="form"
    :submit="submit"
    :destroy="destroy"
  >
    <template #rowActions="{ row }">
      <q-btn flat dense round size="sm" color="info" icon="inventory" @click="openStock(row)">
        <q-tooltip>{{ t('common.details') }}</q-tooltip>
      </q-btn>
    </template>
  </DataTablePage>

  <q-dialog v-model="stockOpen" persistent>
    <q-card style="min-width: 480px; max-width: 720px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ stockWh?.name }} — {{ t('common.quantity') }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="stockOpen = false" />
      </q-card-section>
      <q-card-section>
        <div v-if="stockLoading" class="q-gutter-sm">
          <q-skeleton type="rect" height="40px" v-for="i in 3" :key="i" />
        </div>
        <q-table v-else :rows="stockRows" :columns="stockColumns" row-key="asset_id" flat bordered dense hide-bottom wrap-cells :pagination="{ rowsPerPage: 10 }">
          <template v-if="!stockRows.length" v-slot:no-data>
            <EmptyState icon="inventory" :title="t('common.noData')" :message="t('common.noDataDesc')" />
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { warehouseService, warehouseActions } from 'src/services/warehouse.service'
import DataTablePage from 'src/components/common/DataTablePage.vue'
import EmptyState from 'src/components/common/EmptyState.vue'

const { t } = useI18n()

const stockOpen = ref(false)
const stockLoading = ref(false)
const stockWh = ref(null)
const stockRows = ref([])

const columns = computed(() => [
  { name: 'code', label: t('common.code'), field: 'code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'location', label: t('assets.location'), field: 'location', align: 'left' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
])

const stockColumns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'stock_qty', label: t('common.quantity'), field: 'stock_qty', align: 'right' },
  { name: 'out_qty', label: t('warehouse.transactions.transactionType'), field: 'out_qty', align: 'right' },
])

const form = computed(() => ({
  fields: [
    { key: 'code', label: t('common.code'), type: 'text', required: true, hint: 'e.g. WH-1' },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'location', label: t('assets.location'), type: 'text' },
    { key: 'status', label: t('common.status'), type: 'select', options: [{ label: t('status.active'), value: 'active' }, { label: t('status.inactive'), value: 'inactive' }], required: true },
  ],
  defaults: { status: 'active' },
}))

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

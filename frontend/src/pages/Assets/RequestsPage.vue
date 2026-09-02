<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('requests.title')" :subtitle="t('requests.subtitle')" icon="request_page" />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'Asset_Requests_Report'"
      :title="t('nav.items.requests')"
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
      <div class="col-6 col-md-2">
        <q-select v-model="filters.request_type" :options="typeOptions" :label="t('common.type')" dense outlined clearable emit-value map-options options-dense />
      </div>
    </div>

    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
      <div class="print-title text-h6 q-mb-xs">{{ t('requests.title') }}</div>
      <q-table :rows="rows" :columns="columns" row-key="id" flat dense hide-bottom wrap-cells :pagination="{ rowsPerPage: perPage }" class="q-mt-sm data-table">
        <template v-slot:body-cell-status="props">
          <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn v-if="canApprove && props.row.status === 'department_approval'" flat dense round size="sm" color="positive" icon="check" @click="departmentApprove(props.row, true)"><q-tooltip>{{ t('status.approved') }}</q-tooltip></q-btn>
            <q-btn v-if="canApprove && ['department_approval', 'manager_review'].includes(props.row.status)" flat dense round size="sm" color="warning" icon="verified" @click="managerApprove(props.row, true)"><q-tooltip>{{ t('status.approved') }}</q-tooltip></q-btn>
            <q-btn v-if="canApprove && ['department_approval', 'manager_review'].includes(props.row.status)" flat dense round size="sm" color="negative" icon="block" @click="reject(props.row)"><q-tooltip>{{ t('status.rejected') }}</q-tooltip></q-btn>
            <q-btn v-if="canApprove && props.row.status === 'approved'" flat dense round size="sm" color="positive" icon="flag" @click="complete(props.row)"><q-tooltip>{{ t('status.completed') }}</q-tooltip></q-btn>
          </q-td>
        </template>
        <template v-if="!rows.length" v-slot:no-data>
          <EmptyState icon="request_page" :title="t('common.noData')" :message="t('common.noDataDesc')" />
        </template>
      </q-table>
      <div class="row items-center justify-between q-mt-md print-hide">
        <div class="text-caption text-grey-6">{{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}</div>
        <q-pagination v-model="page" :max="Math.max(1, lastPage)" :max-pages="7" boundary-numbers direction-links />
      </div>
    </div>
    </template>

    <!-- New request dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 440px; max-width: 620px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ t('requests.newRequest') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form @submit="doCreate" class="row q-col-gutter-md">
            <q-select v-model="form.request_type" :options="typeOptions" :label="`${t('requests.requestType')} *`" dense outlined emit-value map-options options-dense :rules="[required]" class="col-12" />
            <q-select v-model="form.department_id" :options="departmentOptions" :label="t('common.department')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-select v-model="form.asset_category_id" :options="categoryOptions" :label="t('common.category')" dense outlined emit-value map-options options-dense clearable class="col-12 col-md-6" />
            <q-input v-model="form.quantity" :label="t('common.quantity')" type="number" dense outlined class="col-6 col-md-3" :rules="[(v) => !v || Number(v) >= 1 || 'Must be >= 1']" />
            <q-input v-model="form.reason" :label="t('transfers.reason')" type="textarea" dense outlined autogrow class="col-12" />
            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn :label="t('requests.newRequest')" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
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
import { assetRequestService } from 'src/services/operations.service'
import { useOptions } from 'src/composables/useOptions'
import { useAuthStore } from 'src/stores/auth'
import { date } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const { departments, categories, opts } = useOptions()
const departmentOptions = computed(() => opts(departments.value))
const categoryOptions = computed(() => opts(categories.value))

const barActions = computed(() => [
  {key: 'add', icon: 'add', label: t('requests.newRequest'), color: 'teal', show: canCreate.value, handler: () => { dialogOpen.value = true }},
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
const form = reactive({ request_type: 'new_asset', department_id: null, asset_category_id: null, quantity: 1, reason: '' })
const filters = reactive({ status: null, request_type: null })

const statusOptions = computed(() => [
  { label: t('status.draft'), value: 'draft' },
  { label: t('status.submitted'), value: 'department_approval' },
  { label: t('status.pending'), value: 'manager_review' },
  { label: t('status.approved'), value: 'approved' },
  { label: t('status.completed'), value: 'completed' },
  { label: t('status.rejected'), value: 'rejected' },
])

const typeOptions = computed(() => [
  { label: t('assets.addAsset'), value: 'new_asset' },
  { label: t('common.type'), value: 'temporary_asset' },
  { label: t('assets.transferAsset'), value: 'replacement_asset' },
  { label: t('maintenance.newRequest'), value: 'repair_request' },
])

const required = (v) => !!v || t('common.required')
const canCreate = computed(() => authStore.hasPermission('requests.create'))
const canApprove = computed(() => authStore.hasPermission('requests.approve'))

const columns = computed(() => [
  { name: 'request_number', label: t('common.code'), field: 'request_number', align: 'left' },
  { name: 'requester_name', label: t('maintenance.requester'), field: 'requester_name', align: 'left' },
  { name: 'request_type', label: t('common.type'), field: 'request_type', align: 'left', format: (v) => v?.replace(/_/g, ' ') },
  { name: 'quantity', label: t('common.quantity'), field: 'quantity', align: 'right' },
  { name: 'department_name', label: t('common.department'), field: 'department_name', align: 'left' },
  { name: 'created_at', label: t('common.created'), field: 'created_at', align: 'left', format: (v) => date(v) },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (filters.status) params.status = filters.status
    if (filters.request_type) params.request_type = filters.request_type
    const { data } = await assetRequestService.list(params)
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
watch(() => [filters.status, filters.request_type], () => { page.value = 1; load() })

async function doCreate() {
  if (saving.value) return // prevent duplicate submissions
  saving.value = true
  try {
    const { data } = await assetRequestService.store({ ...form })
    dialogOpen.value = false
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.createdSuccessEntity', { entity: t('common.entities.request') }) })
    await assetRequestService.submit(data.id)
    $q.notify({ type: 'info', icon: 'send', message: t('requests.submittedSuccess') })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  } finally {
    saving.value = false
  }
}

async function departmentApprove(row, approve) {
  await act(() => assetRequestService.departmentApprove(row.id, approve), row, t('common.updatedSuccessEntity', { entity: t('common.entities.request') }))
}
async function managerApprove(row, approve) {
  await act(() => assetRequestService.managerApprove(row.id, approve), row, t('common.updatedSuccessEntity', { entity: t('common.entities.request') }))
}
async function reject(row) {
  await act(() => assetRequestService.managerApprove(row.id, false), row, t('status.rejected'))
}
async function complete(row) {
  await act(() => assetRequestService.complete(row.id), row, t('status.completed'))
}

async function act(fn, row, msg) {
  try {
    await fn()
    $q.notify({ type: 'positive', icon: 'check_circle', message: msg })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.errors ? Object.values(e.errors).flat().join(' · ') : e.message })
  }
}

onMounted(load)
</script>

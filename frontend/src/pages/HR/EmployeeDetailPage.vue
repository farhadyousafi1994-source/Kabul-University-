<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader
      :title="employee?.full_name || t('hr.profileTitle')"
      :subtitle="employee ? [employee.employee_code, employee.position].filter(Boolean).join(' · ') : ''"
      icon="badge"
    >
      <template #actions>
        <q-btn flat dense no-caps color="primary" icon="arrow_back" :label="t('hr.backToList')" :to="{ name: 'employees' }" />
      </template>
    </AppPageHeader>

    <!-- Loading / error -->
    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="120px" class="q-mb-md rounded-borders" />
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-5"><q-skeleton type="rect" height="300px" class="rounded-borders" /></div>
        <div class="col-12 col-md-7"><q-skeleton type="rect" height="300px" class="rounded-borders" /></div>
      </div>
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <template v-else-if="employee">
      <!-- Profile hero -->
      <div class="emp-hero q-mb-md">
        <q-avatar size="64px" color="white" text-color="primary" class="text-weight-bold emp-hero__avatar">
          {{ initials(employee.full_name) }}
        </q-avatar>
        <div class="emp-hero__body">
          <div class="emp-hero__name">{{ employee.full_name }}</div>
          <div class="emp-hero__meta">
            {{ [employee.position || employee.job_title, employee.department_name].filter(Boolean).join(' · ') || '—' }}
          </div>
          <div class="emp-hero__chips q-mt-xs">
            <StatusBadge :value="employee.status" pill />
            <q-badge outline color="white" class="q-ml-sm">{{ typeLabel(employee.employment_type) }}</q-badge>
          </div>
        </div>
        <div class="q-space" />
        <div class="emp-hero__code">
          <div class="emp-hero__code-v">{{ employee.employee_code }}</div>
          <div class="emp-hero__code-l">{{ t('hr.code') }}</div>
        </div>
      </div>

      <!-- Asset summary -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div class="col-6 col-sm-3">
          <StatCard :label="t('hr.totalAssets')" :value="summary.total" icon="inventory_2" color="primary" />
        </div>
        <div class="col-6 col-sm-3">
          <StatCard :label="t('hr.activeAssets')" :value="summary.active" icon="check_circle" color="positive" />
        </div>
        <div class="col-6 col-sm-3">
          <StatCard :label="t('hr.underMaintenance')" :value="summary.under_maintenance" icon="build" color="warning" />
        </div>
        <div class="col-6 col-sm-3">
          <StatCard :label="t('hr.totalValue')" :value="currency(summary.total_value)" icon="payments" color="primary" small />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <!-- Employee information -->
        <div class="col-12 col-md-5">
          <q-card flat bordered class="full-height">
            <q-card-section class="row items-center q-pb-sm" style="gap: 8px">
              <q-icon name="person" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-bold">{{ t('hr.employeeInfo') }}</div>
              <q-space />
              <q-btn v-if="canEdit" flat dense round size="sm" color="primary" icon="edit" :to="{ name: 'employees' }">
                <q-tooltip>{{ t('common.edit') }}</q-tooltip>
              </q-btn>
            </q-card-section>
            <q-separator />
            <q-list dense padding>
              <q-item v-for="row in infoRows" :key="row.label">
                <q-item-section avatar style="min-width: 40px"><q-icon :name="row.icon" color="grey-6" size="18px" /></q-item-section>
                <q-item-section>
                  <q-item-label caption>{{ row.label }}</q-item-label>
                  <q-item-label>{{ row.value || '—' }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card>
        </div>

        <!-- Assigned assets -->
        <div class="col-12 col-md-7">
          <q-card flat bordered class="full-height">
            <q-card-section class="row items-center q-pb-sm" style="gap: 8px">
              <q-icon name="devices" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-bold">{{ t('hr.assignedAssets') }}</div>
              <q-chip dense size="sm" color="teal-1" text-color="teal-9">{{ assets.length }}</q-chip>
              <q-space />
              <q-btn flat round dense size="sm" color="grey-7" icon="refresh" :loading="assetsLoading" @click="loadAssets">
                <q-tooltip>{{ t('common.refresh') }}</q-tooltip>
              </q-btn>
            </q-card-section>
            <q-separator />
            <div v-if="assetsLoading" class="q-pa-md">
              <q-skeleton v-for="i in 3" :key="i" type="rect" height="40px" class="q-mb-sm" />
            </div>
            <EmptyState v-else-if="!assets.length" icon="devices_other" :title="t('hr.noAssets')" :message="t('hr.noAssetsDesc')" />
            <q-table
              v-else
              :rows="assets"
              :columns="assetColumns"
              row-key="id"
              flat
              dense
              wrap-cells
              hide-bottom
              :pagination="{ rowsPerPage: 0 }"
            >
              <template #body-cell-asset_code="props">
                <q-td :props="props">
                  <router-link :to="{ name: 'asset-detail', params: { id: props.row.id } }" class="text-primary text-weight-medium">
                    {{ props.row.asset_code }}
                  </router-link>
                </q-td>
              </template>
              <template #body-cell-status="props">
                <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
              </template>
              <template #body-cell-actions="props">
                <q-td :props="props">
                  <q-btn
                    v-if="canUnassign"
                    flat round dense size="sm" color="negative" icon="link_off"
                    :loading="unassigningId === props.row.id"
                    :disable="Boolean(unassigningId)"
                    @click="pendingUnassign = props.row"
                  >
                    <q-tooltip>{{ t('hr.unassign') }}</q-tooltip>
                  </q-btn>
                </q-td>
              </template>
            </q-table>
          </q-card>
        </div>
      </div>
    </template>

    <!-- Unassign confirmation -->
    <q-dialog v-model="unassignOpen" persistent>
      <q-card style="min-width: 340px; max-width: 460px">
        <q-card-section class="row items-center no-wrap" style="gap: 12px">
          <q-avatar icon="link_off" color="negative" text-color="white" size="40px" />
          <div class="text-h6">{{ t('hr.unassignTitle') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          {{ t('hr.unassignMessage', { name: pendingUnassign?.name || '' }) }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" :disable="Boolean(unassigningId)" @click="pendingUnassign = null" />
          <q-btn unelevated no-caps color="negative" icon="link_off" :label="t('hr.unassign')"
            :loading="unassigningId === pendingUnassign?.id" @click="doUnassign" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import StatCard from 'src/components/common/StatCard.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { employeeService } from 'src/services/employees.service'
import { assetService } from 'src/services/assets.service'
import { useAuthStore } from 'src/stores/auth'
import { currency, date as formatDate } from 'src/utils/format'

const route = useRoute()
const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const employee = ref(null)
const assets = ref([])
const loading = ref(false)
const assetsLoading = ref(false)
const error = ref('')

const pendingUnassign = ref(null)
const unassigningId = ref(null)
const unassignOpen = computed({
  get: () => Boolean(pendingUnassign.value),
  set: (v) => { if (!v) pendingUnassign.value = null },
})

const canEdit = computed(() => authStore.hasPermission('employees.update'))
const canUnassign = computed(() => authStore.hasPermission('assets.update'))

const summary = computed(() => employee.value?.asset_summary || { total: 0, active: 0, under_maintenance: 0, total_value: 0 })

const typeLabel = (v) => ({ full_time: t('hr.fullTime'), part_time: t('hr.partTime'), contract: t('hr.contract') }[v] || v || '—')
const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()

const infoRows = computed(() => {
  const e = employee.value || {}
  return [
    { icon: 'tag', label: t('hr.code'), value: e.employee_code },
    { icon: 'person', label: t('hr.fullName'), value: e.full_name },
    { icon: 'account_tree', label: t('hr.department'), value: [e.department_name, e.faculty_name].filter(Boolean).join(' — ') },
    { icon: 'work', label: t('hr.position'), value: e.position || e.job_title },
    { icon: 'mail', label: t('common.email'), value: e.email },
    { icon: 'call', label: t('common.phone'), value: e.phone },
    { icon: 'schedule', label: t('hr.employmentType'), value: typeLabel(e.employment_type) },
    { icon: 'event', label: t('hr.hireDate'), value: e.hire_date ? formatDate(e.hire_date) : '' },
    { icon: 'supervisor_account', label: t('hr.manager'), value: e.manager_name },
    { icon: 'home', label: t('hr.address'), value: e.address },
    { icon: 'account_circle', label: t('hr.linkedUser'), value: e.user_username || t('hr.noLinkedUser') },
  ]
})

const assetColumns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'name', label: t('common.name'), field: 'name', align: 'left' },
  { name: 'category_name', label: t('common.category'), field: 'category_name', align: 'left', format: (v) => v || '—' },
  { name: 'serial_number', label: t('hr.serialNumber'), field: 'serial_number', align: 'left', format: (v) => v || '—' },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'updated_at', label: t('hr.assignedDate'), field: 'updated_at', align: 'left', format: (v) => (v ? formatDate(v) : '—') },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await employeeService.get(route.params.id)
    employee.value = data
    await loadAssets()
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

async function loadAssets() {
  assetsLoading.value = true
  try {
    const { data } = await employeeService.assets(route.params.id)
    assets.value = data?.data || []
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.loadFailed') })
  } finally {
    assetsLoading.value = false
  }
}

async function doUnassign() {
  const row = pendingUnassign.value
  if (!row || unassigningId.value) return
  unassigningId.value = row.id
  try {
    await assetService.update(row.id, { employee_id: null })
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('hr.unassignedSuccess') })
    pendingUnassign.value = null
    // Refresh both the list and the summary counters.
    const { data } = await employeeService.get(route.params.id)
    employee.value = data
    await loadAssets()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  } finally {
    unassigningId.value = null
  }
}

watch(() => route.params.id, () => { if (route.name === 'employee-detail') load() })
onMounted(load)
</script>

<style lang="sass" scoped>
.emp-hero
  display: flex
  align-items: center
  gap: 16px
  padding: 18px
  border-radius: 14px
  color: #fff
  background: linear-gradient(115deg, var(--ku-header-from, $primary) 0%, var(--ku-header-to, #00695c) 100%)
  box-shadow: 0 6px 18px rgba(0, 0, 0, .10)

  &__avatar
    font-size: 22px
    flex-shrink: 0

  &__body
    min-width: 0

  &__name
    font-size: 19px
    font-weight: 700
    line-height: 1.25

  &__meta
    font-size: 12.5px
    opacity: .9

  &__code
    flex-shrink: 0
    text-align: center
    padding: 8px 18px
    border-radius: 12px
    background: rgba(255, 255, 255, .16)
    border: 1px solid rgba(255, 255, 255, .28)

  &__code-v
    font-size: 16px
    font-weight: 700

  &__code-l
    font-size: 10.5px
    opacity: .85

@media (max-width: 599px)
  .emp-hero
    flex-wrap: wrap
    padding: 14px
</style>

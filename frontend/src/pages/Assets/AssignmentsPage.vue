<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader
      :title="t('assignments.title')"
      :subtitle="t('assignments.subtitle')"
      icon="assignment_ind"
      :meta="headerMeta"
    />

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="'Assignments_Report'"
      :title="t('assignments.title')"
    />

    <!-- Toolbar: search + filters -->
    <div class="ku-toolbar row items-center q-col-gutter-sm print-hide">
      <div class="col-12 col-md-4">
        <q-input
          v-model="search"
          dense
          outlined
          clearable
          debounce="350"
          :placeholder="t('assets.searchPlaceholder')"
          data-cy="assignments-search"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-md-2">
        <q-select
          v-model="filters.status"
          :options="statusOptions"
          :label="t('common.status')"
          dense
          outlined
          clearable
          emit-value
          map-options
          options-dense
        />
      </div>
      <div class="col-12 col-md-3">
        <EmployeeSelect
          v-model="filters.employee_id"
          :label="t('assignments.assignedTo')"
          :active-only="false"
          dense
          outlined
          clearable
        />
      </div>
      <div class="col-6 col-md-2">
        <q-btn
          :label="t('common.reset')"
          icon="restart_alt"
          outline
          dense
          color="grey-7"
          class="q-px-sm"
          :disable="!hasActiveFilters"
          @click="resetFilters"
        />
      </div>
    </div>

    <div v-if="loading && !rows.length" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else>
      <div class="print-area">
        <div class="print-title text-h6 q-mb-xs">{{ t('assignments.title') }}</div>
        <q-table
          :rows="rows"
          :columns="columns"
          row-key="id"
          flat
          dense
          hide-bottom
          wrap-cells
          :loading="loading"
          :pagination="{ rowsPerPage: perPage }"
          class="q-mt-sm data-table"
          :no-data-label="t('common.noData')"
        >
          <template #body-cell-asset_code="props">
            <q-td :props="props" class="text-weight-medium">{{ props.row.asset_code || '—' }}</q-td>
          </template>
          <template #body-cell-employee_name="props">
            <q-td :props="props">
              <div class="row items-center no-wrap q-gutter-xs">
                <q-avatar v-if="employeeName(props.row)" size="24px" color="primary" text-color="white">
                  <span class="text-caption text-weight-bold">{{ initials(employeeName(props.row)) }}</span>
                </q-avatar>
                <div class="col" style="min-width: 0">
                  <div class="ellipsis text-weight-medium">{{ employeeName(props.row) || t('assets.unassigned') }}</div>
                  <div v-if="props.row.employee_code" class="text-caption text-grey-6">{{ props.row.employee_code }}</div>
                </div>
              </div>
            </q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props"><StatusBadge :value="props.row.status" /></q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" class="ku-row-actions">
              <q-btn
                v-if="props.row.asset_id"
                flat
                dense
                round
                size="sm"
                color="grey-8"
                icon="visibility"
                :to="{ name: 'asset-detail', params: { id: props.row.asset_id } }"
                :aria-label="t('assignments.viewAsset')"
              >
                <q-tooltip>{{ t('assignments.viewAsset') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="canReturn && props.row.status === 'active'"
                flat
                dense
                round
                size="sm"
                color="primary"
                icon="undo"
                :loading="returningId === props.row.id"
                :aria-label="t('assignments.returnTitle')"
                data-cy="return-btn"
                @click="openReturn(props.row)"
              >
                <q-tooltip>{{ t('assignments.returnTitle') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template v-if="!rows.length" #no-data>
            <EmptyState
              icon="assignment_ind"
              :title="t('common.noData')"
              :message="t('common.noDataDesc')"
              :action-label="canAssign ? t('assignments.assignTitle') : ''"
              @action="openAssign"
            />
          </template>
        </q-table>

        <div class="row items-center justify-between q-mt-md q-gutter-sm print-hide">
          <div class="text-caption text-grey-6">
            {{ t('common.showingRecords', { count: rows.length, total, page, pages: Math.max(1, lastPage) }) }}
          </div>
          <q-pagination
            v-model="page"
            :max="Math.max(1, lastPage)"
            :max-pages="7"
            boundary-numbers
            direction-links
            :disable="loading"
          />
        </div>
      </div>
    </template>

    <!-- ------------------------------------------------------------------
         Assign dialog — Create flow:
         submit → loading → API → ✓ notify → close → reset → refresh
                              → ✕ notify + field errors → dialog stays open
         ------------------------------------------------------------------ -->
    <q-dialog v-model="dialogOpen" persistent @hide="onDialogHide">
      <q-card class="q-dialog-card" style="min-width: 420px; max-width: 640px">
        <q-card-section class="row items-center q-pb-none">
          <q-avatar size="34px" class="dialog-icon q-mr-sm"><q-icon name="assignment_ind" size="19px" /></q-avatar>
          <div class="col min-width-0">
            <div class="text-h6">{{ t('assignments.assignTitle') }}</div>
            <div class="text-caption text-grey-7">{{ t('assignments.assignHint') }}</div>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            :disable="assigning"
            :aria-label="t('common.close')"
            @click="dialogOpen = false"
          />
        </q-card-section>

        <q-card-section>
          <q-form ref="assignFormRef" class="column q-gutter-md" @submit.prevent="submitAssign">
            <!-- Asset picker: searchable, shows already-assigned assets -->
            <q-select
              v-model="form.asset_id"
              :options="assetOptions"
              :label="`${t('assignments.asset')} *`"
              :placeholder="t('assignments.assetPlaceholder')"
              :loading="assetsLoading"
              :disable="assigning"
              dense
              outlined
              use-input
              input-debounce="200"
              emit-value
              map-options
              options-dense
              :rules="[requiredRule]"
              :error="Boolean(assignErrors.asset_id)"
              :error-message="assignErrors.asset_id"
              :no-option-label="assetsLoading ? t('common.loading') : t('assignments.noAssignableAssets')"
              data-cy="assign-asset"
              @filter="filterAssets"
              @update:model-value="assignAction.clearFieldErrors()"
            >
              <template #prepend><q-icon name="inventory_2" /></template>
              <template #option="scope">
                <q-item v-bind="scope.itemProps" :disable="scope.opt.disable">
                  <q-item-section avatar>
                    <q-icon :name="scope.opt.disable ? 'lock' : 'inventory_2'" :color="scope.opt.disable ? 'grey-6' : 'primary'" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.caption }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="scope.opt.disable" side>
                    <q-badge outline color="grey-7">{{ scope.opt.statusLabel }}</q-badge>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- Employee picker: dedicated `employees` table, never `users` -->
            <EmployeeSelect
              v-model="form.employee_id"
              :label="`${t('assignments.assignedTo')} *`"
              :placeholder="t('assignments.employeePlaceholder')"
              :disable="assigning"
              dense
              outlined
              :rules="[requiredRule]"
              data-cy="assign-employee"
              @update:model-value="assignAction.clearFieldErrors()"
            />

            <q-input
              v-model="form.expected_return_date"
              :label="t('assets.expectedReturnDate')"
              type="date"
              dense
              outlined
              :disable="assigning"
              :error="Boolean(assignErrors.expected_return_date)"
              :error-message="assignErrors.expected_return_date"
            />

            <q-input
              v-model="form.notes"
              :label="t('common.notes')"
              :placeholder="t('common.notesPlaceholder')"
              type="textarea"
              dense
              outlined
              autogrow
              maxlength="500"
              counter
              :disable="assigning"
            />

            <div class="row justify-end q-gutter-sm">
              <q-btn
                :label="t('common.cancel')"
                flat
                no-caps
                color="grey-8"
                :disable="assigning"
                @click="dialogOpen = false"
              />
              <q-btn
                :label="assigning ? t('assignments.assigning') : t('assignments.assignTitle')"
                :icon="assigning ? undefined : 'assignment_turned_in'"
                type="submit"
                unelevated
                no-caps
                color="primary"
                :loading="assigning"
                data-cy="assign-submit"
              >
                <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('assignments.assigning') }}</template>
              </q-btn>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Return (unassign) dialog ------------------------------------------- -->
    <q-dialog v-model="returnOpen" persistent>
      <q-card class="q-dialog-card" style="min-width: 400px; max-width: 560px">
        <q-card-section class="row items-center q-pb-none">
          <q-avatar size="34px" class="dialog-icon q-mr-sm"><q-icon name="undo" size="19px" /></q-avatar>
          <div class="col min-width-0">
            <div class="text-h6">{{ t('assignments.returnTitle') }}</div>
            <div class="text-caption text-grey-7 ellipsis">
              {{ returnTarget?.asset_code }} · {{ returnTarget?.asset_name }} → {{ employeeName(returnTarget) }}
            </div>
          </div>
          <q-btn flat round dense icon="close" :disable="returning" :aria-label="t('common.close')" @click="returnOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-form class="column q-gutter-md" @submit.prevent="submitReturn">
            <q-select
              v-model="returnForm.condition_on_return"
              :options="conditionOptions"
              :label="`${t('assignments.conditionOnReturn')} *`"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :rules="[requiredRule]"
              :disable="returning"
              :error="Boolean(returnErrors.condition_on_return)"
              :error-message="returnErrors.condition_on_return"
            />
            <q-input
              v-model="returnForm.returned_date"
              :label="t('assignments.returnedDate')"
              type="date"
              dense
              outlined
              :disable="returning"
            />
            <q-input
              v-model="returnForm.notes"
              :label="t('common.notes')"
              type="textarea"
              dense
              outlined
              autogrow
              maxlength="500"
              :disable="returning"
            />
            <div class="row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat no-caps color="grey-8" :disable="returning" @click="returnOpen = false" />
              <q-btn
                :label="returning ? t('assignments.returning') : t('assignments.returnTitle')"
                type="submit"
                unelevated
                no-caps
                color="primary"
                :loading="returning"
                data-cy="return-submit"
              >
                <template #loading><q-spinner-dots class="q-mr-sm" />{{ t('assignments.returning') }}</template>
              </q-btn>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * Module 8 — Asset assignments (assign / return / unassign)
 * ---------------------------------------------------------------------------
 *
 * Assignments always connect an ASSET to an EMPLOYEE from the dedicated
 * `employees` table (never a `users` account):
 *
 *   assignments.asset_id     → assets.id
 *   assignments.employee_id  → employees.id
 *
 * Flow (identical to every other module — see src/composables/useAction.js):
 *
 *   Click "Assign Asset" → dialog opens → assets + employees load
 *     → pick asset & employee → Assign → [ ⟳ Assigning… ] (button disabled,
 *       duplicate clicks ignored) → POST /assets/{id}/assign
 *     → 2xx  ✓ "Asset assigned successfully." → dialog closes → form resets
 *            → assignment table refreshes
 *     → 4xx/5xx ✕ error toast + inline field errors → dialog STAYS open with
 *            everything the user typed preserved
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import EmployeeSelect from 'src/components/common/EmployeeSelect.vue'
import { assignmentService } from 'src/services/operations.service'
import { assetService } from 'src/services/assets.service'
import { useAuthStore } from 'src/stores/auth'
import { useAction } from 'src/composables/useAction'
import { notify } from 'src/utils/notify'
import { date } from 'src/utils/format'

const { t, te } = useI18n()
const authStore = useAuthStore()

// -- permissions -------------------------------------------------------------
const canAssign = computed(() => authStore.hasPermission('assets.assign'))
const canReturn = computed(() => authStore.hasPermission('assets.return'))

// -- table state -------------------------------------------------------------
const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const search = ref('')
const loading = ref(false)
const error = ref('')
const filters = reactive({ status: null, employee_id: null })

const statusOptions = computed(() => [
  { label: t('status.active'), value: 'active' },
  { label: t('status.returned'), value: 'returned' },
  { label: t('status.overdue'), value: 'overdue' },
])

const conditionOptions = computed(() => [
  { label: t('condition.excellent'), value: 'excellent' },
  { label: t('condition.good'), value: 'good' },
  { label: t('condition.fair'), value: 'fair' },
  { label: t('condition.poor'), value: 'poor' },
  { label: t('condition.damaged'), value: 'damaged' },
])

const columns = computed(() => [
  { name: 'asset_code', label: t('assets.assetCode'), field: 'asset_code', align: 'left' },
  { name: 'asset_name', label: t('assignments.asset'), field: 'asset_name', align: 'left' },
  { name: 'employee_name', label: t('assignments.assignedTo'), field: 'employee_name', align: 'left' },
  { name: 'assigned_date', label: t('assignments.assignedDate'), field: 'assigned_date', align: 'left', format: (v) => date(v) },
  { name: 'expected_return_date', label: t('assets.expectedReturnDate'), field: 'expected_return_date', align: 'left', format: (v) => date(v) },
  { name: 'returned_date', label: t('assignments.returnDate'), field: 'returned_date', align: 'left', format: (v) => date(v) },
  { name: 'status', label: t('common.status'), field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
])

const headerMeta = computed(() => [
  { icon: 'assignment_ind', label: `${t('assignments.statTotal')}: ${total.value}` },
  { icon: 'check_circle', label: `${t('assignments.statActive')}: ${countBy('active')}` },
  { icon: 'event_busy', label: `${t('assignments.statOverdue')}: ${countBy('overdue')}` },
])

const barActions = computed(() => [
  {
    key: 'assign',
    icon: 'assignment_turned_in',
    label: t('assignments.assignTitle'),
    color: 'primary',
    show: canAssign.value,
    handler: openAssign,
  },
])

const hasActiveFilters = computed(() => Boolean(search.value || filters.status || filters.employee_id))

function countBy(status) {
  return rows.value.filter((r) => r.status === status).length
}

const employeeName = (row) => row?.employee_name || row?.assignee_name || ''
const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (filters.status) params.status = filters.status
    if (filters.employee_id) params.employee_id = filters.employee_id
    const { data } = await assignmentService.list(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
    if (page.value > lastPage.value) page.value = Math.max(1, lastPage.value)
  } catch (e) {
    error.value = e?.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  search.value = ''
  filters.status = null
  filters.employee_id = null
  page.value = 1
  load()
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => [filters.status, filters.employee_id], () => { page.value = 1; load() })

// -- assign ------------------------------------------------------------------
const dialogOpen = ref(false)
const assignFormRef = ref(null)
const form = reactive({ asset_id: null, employee_id: null, expected_return_date: null, notes: '' })

const assetOptions = ref([])
const allAssets = ref([])
const assetsLoading = ref(false)
// Bumped every time the dialog opens, so the asset list is re-fetched rather
// than served from a stale snapshot taken before the dialog was opened.
const dialogSession = ref(0)
let assetsLoadedFor = null

/**
 * One shared lifecycle per operation: loading flag, duplicate-submission
 * guard, success/error notifications and server-validation → field mapping.
 */
const assignAction = useAction()
const returnAction = useAction()

// Aliases so the template can rely on ref auto-unwrapping.
const assigning = assignAction.pending
const assignErrors = assignAction.fieldErrors
const returning = returnAction.pending
const returnErrors = returnAction.fieldErrors

const requiredRule = (v) => (v !== null && v !== undefined && String(v).trim() !== '') || t('common.required')

/** `AST-001 — Dell Latitude Laptop`, with already-assigned assets disabled. */
function toAssetOption(asset) {
  const assignable = ['available', 'reserved'].includes(asset.status)
  const label = `${asset.asset_code} — ${asset.name}`
  const detail = [asset.brand, asset.model, asset.department_name].filter(Boolean).join(' · ')
  return {
    label,
    value: asset.id,
    caption: detail || (assignable ? t('assignments.availableForAssignment') : t('assignments.alreadyAssigned')),
    statusLabel: assignable
      ? t('assignments.availableForAssignment')
      : te(`status.${asset.status}`) ? t(`status.${asset.status}`) : asset.status,
    disable: !assignable,
    haystack: `${label} ${detail} ${asset.serial_number || ''}`.toLowerCase(),
  }
}

async function loadAssignableAssets(force = false) {
  if (assetsLoading.value) return
  if (!force && assetsLoadedFor === dialogSession.value) return
  assetsLoading.value = true
  try {
    // No status filter: the picker shows the full picture and disables what
    // cannot be assigned, so the user understands *why* an asset is locked.
    const { data } = await assetService.list({ per_page: 100, sort: 'asset_code', direction: 'asc' })
    allAssets.value = data?.data || []
    assetOptions.value = allAssets.value.map(toAssetOption)
    assetsLoadedFor = dialogSession.value
  } catch (err) {
    allAssets.value = []
    assetOptions.value = []
    notify.error(t('assignments.assetsLoadFailed'), { caption: err?.message || '' })
  } finally {
    assetsLoading.value = false
  }
}

/** Client-side search over code / name / brand / serial. */
function filterAssets(term, update) {
  update(() => {
    const needle = String(term || '').trim().toLowerCase()
    assetOptions.value = needle
      ? allAssets.value.map(toAssetOption).filter((o) => o.haystack.includes(needle))
      : allAssets.value.map(toAssetOption)
  })
}

function resetAssignForm() {
  form.asset_id = null
  form.employee_id = null
  form.expected_return_date = null
  form.notes = ''
  assignAction.clearFieldErrors()
  assignFormRef.value?.resetValidation?.()
}

async function openAssign() {
  if (!canAssign.value) return
  dialogSession.value += 1
  assetsLoadedFor = null
  resetAssignForm()
  dialogOpen.value = true
  // Assets are refreshed every time the dialog opens so a newly registered or
  // newly returned asset is immediately assignable.
  await loadAssignableAssets(true)
}

function onDialogHide() {
  // Only clear transient state — never while a request is still in flight.
  if (!assigning) resetAssignForm()
}

async function submitAssign() {
  // Client-side validation first: no request is sent for an incomplete form.
  const valid = assignFormRef.value ? await assignFormRef.value.validate() : true
  if (!valid) return

  await assignAction.run(
    () => assignmentService.assign(form.asset_id, {
      asset_id: form.asset_id,
      employee_id: form.employee_id,
      expected_return_date: form.expected_return_date || null,
      notes: form.notes || null,
    }),
    {
      successMessage: t('assignments.assignedOk'),
      errorMessage: t('assignments.assignFailed'),
      onSuccess: async () => {
        dialogOpen.value = false
        resetAssignForm()
        await load()
      },
    },
  )
}

// -- return / unassign -------------------------------------------------------
const returnOpen = ref(false)
const returnTarget = ref(null)
const returningId = ref(null)
const returnForm = reactive({ condition_on_return: 'good', returned_date: null, notes: '' })

function openReturn(row) {
  returnTarget.value = row
  returnForm.condition_on_return = 'good'
  returnForm.returned_date = new Date().toISOString().slice(0, 10)
  returnForm.notes = row.notes || ''
  returnAction.clearFieldErrors()
  returnOpen.value = true
}

async function submitReturn() {
  const row = returnTarget.value
  if (!row) return

  returningId.value = row.id
  try {
    await returnAction.run(
      () => assignmentService.returnAsset(row.id, {
        condition_on_return: returnForm.condition_on_return,
        returned_date: returnForm.returned_date || null,
        notes: returnForm.notes || null,
      }),
      {
        successMessage: t('assignments.returnedOk'),
        errorMessage: t('assignments.returnFailed'),
        onSuccess: async () => {
          returnOpen.value = false
          returnTarget.value = null
          await load()
        },
      },
    )
  } finally {
    returningId.value = null
  }
}

onMounted(load)
</script>

<style lang="sass" scoped>
.dialog-icon
  background: var(--ku-gold-grad)
  color: #fff

.min-width-0
  min-width: 0
</style>

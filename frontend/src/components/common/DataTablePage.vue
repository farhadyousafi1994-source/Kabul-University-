<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="title" :subtitle="subtitle" :icon="icon" :meta="headerMeta">
      <template #actions>
        <slot name="headerActions" />
      </template>
    </AppPageHeader>

    <!-- Shared action bar (same buttons on every table) -->
    <TableActionBar
      class="print-hide"
      :actions="barActions"
      :rows="rows"
      :columns="columns"
      :filename="exportFilename"
    />

    <!-- Toolbar: search + filters + view options -->
    <div class="ku-toolbar print-hide">
      <div class="row items-center q-col-gutter-sm">
        <div class="col-12 col-md-4">
          <q-input
            v-model="search"
            dense
            outlined
            clearable
            debounce="350"
            :placeholder="searchPlaceholder || `${t('common.search')} ${entityLabel}…`"
            data-cy="search-input"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </div>
        <div v-for="f in filters" :key="f.key" class="col-6 col-md-2">
          <q-select
            v-model="filterValues[f.key]"
            :options="f.options"
            :label="f.label"
            dense
            outlined
            clearable
            emit-value
            map-options
            :options-dense="true"
            :loading="f.loading"
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

        <!-- View options: density · columns · fullscreen -->
        <div class="col-12">
          <div class="row items-center q-gutter-x-xs">
            <q-space />
            <q-btn
              flat
              round
              dense
              size="sm"
              class="view-opt"
              :icon="comfortable ? 'reorder' : 'table_rows'"
              :aria-label="t('common.compactRows')"
              @click="comfortable = !comfortable"
            >
              <q-tooltip>{{ t('common.compactRows') }}</q-tooltip>
            </q-btn>
            <q-btn flat round dense size="sm" class="view-opt" icon="view_column" :aria-label="t('common.columns')">
              <q-tooltip>{{ t('common.columns') }}</q-tooltip>
              <q-menu fit anchor="bottom right" self="top right">
                <q-list dense style="min-width: 200px">
                  <q-item-label header>{{ t('common.columns') }}</q-item-label>
                  <q-item v-for="c in columns" :key="c.name" tag="label" dense>
                    <q-item-section avatar min-width="auto">
                      <q-checkbox
                        :model-value="isColumnVisible(c)"
                        :disable="c.name === 'actions'"
                        dense
                        @update:model-value="toggleColumn(c)"
                      />
                    </q-item-section>
                    <q-item-section>{{ c.label }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <q-btn
              flat
              round
              dense
              size="sm"
              class="view-opt"
              :icon="tableFullscreen ? 'fullscreen_exit' : 'fullscreen'"
              :aria-label="tableFullscreen ? t('common.exitFullscreen') : t('common.fullscreen')"
              @click="tableFullscreen = !tableFullscreen"
            >
              <q-tooltip>{{ tableFullscreen ? t('common.exitFullscreen') : t('common.fullscreen') }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="q-mt-sm">
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" class="q-mb-sm" />
      <q-skeleton type="rect" height="64px" />
    </div>

    <!-- Error state -->
    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <!-- Bulk actions bar -->
    <div v-if="!loading && !error && selectionEnabled && selected.length" class="ku-bulkbar q-mb-sm print-hide">
      <q-icon name="check_circle" size="20px" class="q-mr-sm" />
      <span class="text-weight-bold">{{ t('common.selectedCount', { n: selected.length }) }}</span>
      <q-space />
      <q-btn
        :label="t('common.bulkArchive')"
        icon="archive"
        dense
        unelevated
        color="negative"
        :loading="bulkWorking"
        @click="bulkDestroy"
      />
      <q-btn :label="t('common.clearSelection')" icon="close" dense flat color="grey-7" @click="selected = []" />
    </div>

    <!-- Table -->
    <template v-if="!loading && !error">
      <div :class="{ 'ku-table-fullscreen': tableFullscreen }">
        <div class="print-area">
          <div class="print-title text-h6 q-mb-xs">{{ title }}</div>
          <q-table
            v-model:selected="selected"
            :rows="rows"
            :columns="visibleColumns"
            row-key="id"
            flat
            dense
            :selection="selectionEnabled ? 'multiple' : 'none'"
            :pagination="{ rowsPerPage: perPage }"
            hide-bottom
            wrap-cells
            :loading="loading"
            :class="['q-mt-sm data-table', { 'data-table--comfortable': comfortable }]"
            :no-data-label="emptyMessage || t('common.noData')"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="ku-row-actions">
                <slot name="rowActions" :row="props.row" />
                <q-btn
                  v-if="editForm && canEdit"
                  flat
                  dense
                  round
                  size="sm"
                  color="primary"
                  icon="edit"
                  :aria-label="`${t('common.edit')} ${entityLabel}`"
                  data-cy="edit-btn"
                  @click="openEdit(props.row)"
                >
                  <q-tooltip>{{ t('common.edit') }}</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="destroy && canDelete"
                  flat
                  dense
                  round
                  size="sm"
                  color="negative"
                  icon="delete_outline"
                  :aria-label="`${t('common.delete')} ${entityLabel}`"
                  data-cy="delete-btn"
                  @click="confirmDestroy(props.row)"
                >
                  <q-tooltip>{{ t('common.archive') }}</q-tooltip>
                </q-btn>
              </q-td>
            </template>
            <template v-if="isEmpty" v-slot:no-data>
              <EmptyState
                :icon="emptyIcon"
                :title="emptyTitle || t('common.nothingHere')"
                :message="emptyMessage || t('common.noDataDesc')"
                :action-label="createForm && canCreate ? resolvedCreateLabel : ''"
                @action="openCreate"
              />
            </template>
          </q-table>

          <div class="row items-center justify-between q-mt-md q-gutter-sm print-hide">
            <div class="row items-center q-gutter-sm">
              <q-select
                v-model="perPage"
                :options="perPageOptions"
                dense
                outlined
                :label="t('common.recordsPerPage')"
                style="min-width: 118px"
              />
              <div class="text-caption text-grey-6">
                {{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}
              </div>
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
      </div>
    </template>

    <!-- Create / edit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 420px; max-width: 720px" class="q-dialog-card">
        <q-card-section class="row items-center q-pb-none">
          <q-avatar v-if="icon" size="34px" class="dialog-icon q-mr-sm">
            <q-icon :name="editing ? 'edit' : 'add'" size="19px" />
          </q-avatar>
          <div class="text-h6">{{ editing ? `${t('common.edit')} ${entityLabel}` : resolvedCreateLabel }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :aria-label="t('common.close')" @click="dialogOpen = false" />
        </q-card-section>

        <q-card-section>
          <q-form @submit="save" class="row q-col-gutter-md">
            <div
              v-for="field in formFields"
              :key="field.key"
              class="col-12"
              :class="field.col || 'col-md-6'"
            >
              <q-input
                v-if="field.type === 'text' || field.type === 'number' || field.type === 'date' || field.type === 'password'"
                v-model="form[field.key]"
                :type="field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : field.type === 'date' ? 'date' : 'text'"
                :label="field.label + (field.required ? ' *' : '')"
                :hint="field.hint"
                dense
                outlined
                :disable="saving"
                :error="Boolean(fieldErrors[field.key])"
                :error-message="fieldErrors[field.key]"
                :rules="[(v) => !field.required || (v !== null && v !== undefined && String(v).trim() !== '') || `${field.label} ${t('common.required')}`]"
                @update:model-value="clearFieldError(field.key)"
              />
              <q-select
                v-else-if="field.type === 'select'"
                v-model="form[field.key]"
                :options="field.options || []"
                :label="field.label + (field.required ? ' *' : '')"
                :hint="field.hint"
                dense
                outlined
                emit-value
                map-options
                :options-dense="true"
                :disable="saving"
                :multiple="!!field.multiple"
                :use-input="!!field.multiple"
                hide-selected
                :error="Boolean(fieldErrors[field.key])"
                :error-message="fieldErrors[field.key]"
                :rules="[(v) => !field.required || (field.multiple ? (v && v.length > 0) : !!v) || `${field.label} ${t('common.required')}`]"
                @update:model-value="clearFieldError(field.key)"
              >
                <template v-if="field.multiple" v-slot:selected-item="scope">
                  <q-chip removable dense :label="scope.opt.label" @remove="scope.removeAtIndex(scope.index)" />
                </template>
              </q-select>
              <q-input
                v-else-if="field.type === 'textarea'"
                v-model="form[field.key]"
                :label="field.label"
                type="textarea"
                dense
                outlined
                autogrow
                :disable="saving"
                :error="Boolean(fieldErrors[field.key])"
                :error-message="fieldErrors[field.key]"
                @update:model-value="clearFieldError(field.key)"
              />
              <q-toggle
                v-else-if="field.type === 'toggle'"
                v-model="form[field.key]"
                :label="field.label"
              />
            </div>

            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" :disable="saving" @click="dialogOpen = false" />
              <q-btn
                :label="saving ? t('common.saving') : editing ? t('common.update') : t('common.save')"
                type="submit"
                color="primary"
                icon="save"
                :loading="saving"
                :disable="saving"
              >
                <template #loading><q-spinner-dots /></template>
              </q-btn>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import TableActionBar from 'src/components/common/TableActionBar.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { useAuthStore } from 'src/stores/auth'
import { useAction } from 'src/composables/useAction'
import { confirmDelete, confirmAction } from 'src/utils/confirm'
import { notify } from 'src/utils/notify'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: 'table_rows' },
  entityLabel: { type: String, required: true },
  load: { type: Function, required: true },
  columns: { type: Array, required: true },
  perms: { type: String, required: true },
  searchPlaceholder: { type: String, default: '' },
  filters: { type: Array, default: () => [] },
  createForm: { type: Object, default: null },
  editForm: { type: Object, default: null },
  submit: { type: Function, default: null },
  destroy: { type: Function, default: null },
  createLabel: { type: String, default: '' },
  createIcon: { type: String, default: 'add' },
  emptyIcon: { type: String, default: 'inbox' },
  emptyTitle: { type: String, default: '' },
  emptyMessage: { type: String, default: '' },
  refreshKey: { type: [Number, String], default: 0 },
  /** Extra action-bar buttons (e.g. Import / Advanced search) in addition to the
      built-in Create + Print / PDF / Excel. Same shape as TableActionBar `actions`. */
  actions: { type: Array, default: () => [] },
  /** Base filename for Print / PDF / Excel exports. */
  exportFilename: { type: String, default: '' },
  /** Metadata chips for the page hero, e.g. ['1,240 records'] or [{icon,label}]. */
  headerMeta: { type: Array, default: () => [] },
})

const { t } = useI18n()
const authStore = useAuthStore()

const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const perPageOptions = [10, 20, 50, 100]
const search = ref('')
const loading = ref(false)
const error = ref('')
const dialogOpen = ref(false)
const editing = ref(null)

// One shared async-action lifecycle for every create / update / delete on this
// table: loading flag, duplicate-submission guard, success toast, error toast
// and server-validation → field mapping. See src/composables/useAction.js.
const createAction = useAction()
const saving = createAction.pending
const fieldErrors = createAction.fieldErrors

// View options ----------------------------------------------------------------
const comfortable = ref(false)
const tableFullscreen = ref(false)
const selected = ref([])
const selectionEnabled = computed(() => Boolean(props.destroy) && canDelete.value)
const bulkWorking = ref(false)

const hiddenColumns = ref(new Set())
const visibleColumns = computed(() => props.columns.filter((c) => !hiddenColumns.value.has(c.name) || c.name === 'actions'))
function isColumnVisible(c) {
  return !hiddenColumns.value.has(c.name) || c.name === 'actions'
}
function toggleColumn(c) {
  if (c.name === 'actions') return
  const next = new Set(hiddenColumns.value)
  if (next.has(c.name)) next.delete(c.name)
  else next.add(c.name)
  hiddenColumns.value = next
}

function onFullscreenKey(e) {
  if (e.key === 'Escape') tableFullscreen.value = false
}
onMounted(() => window.addEventListener('keydown', onFullscreenKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onFullscreenKey))

function clearFieldError(key) {
  delete fieldErrors[key]
}

const filterValues = reactive({})
for (const f of props.filters) filterValues[f.key] = null

const canCreate = computed(() => authStore.hasPermission(`${props.perms}.create`))
const canEdit = computed(() => authStore.hasPermission(`${props.perms}.update`))
const canDelete = computed(() => authStore.hasPermission(`${props.perms}.delete`))
const hasActiveFilters = computed(() => Object.values(filterValues).some((v) => v !== null && v !== undefined && v !== ''))
const isEmpty = computed(() => !rows.value.length)

const resolvedCreateLabel = computed(() => props.createLabel || t('common.add'))

// The shared action bar: the Create button lives here now (it used to be in
// the page header), followed by any parent-supplied buttons, followed by the
// built-in Print / PDF / Excel handled inside TableActionBar.
const barActions = computed(() => [
  {
    key: 'create',
    icon: props.createIcon,
    label: resolvedCreateLabel.value,
    color: 'primary',
    show: Boolean(props.createForm && canCreate.value),
    handler: openCreate,
  },
  ...props.actions,
])

const formFields = computed(() => (editing.value ? (props.editForm?.fields || props.createForm?.fields) : props.createForm?.fields) || [])
const form = reactive({})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    for (const [k, v] of Object.entries(filterValues)) {
      if (v !== null && v !== undefined && v !== '') params[k] = v
    }
    const { data } = await props.load(params)
    rows.value = data?.data || []
    total.value = data?.meta?.total || 0
    lastPage.value = data?.meta?.last_page || 1
    if (page.value > lastPage.value) page.value = lastPage.value
    selected.value = []
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(perPage, () => { page.value = 1; load() })
watch(search, () => { page.value = 1; load() })
watch(() => props.refreshKey, load)

function openCreate() {
  editing.value = null
  createAction.clearFieldErrors()
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, props.createForm?.defaults || {})
  dialogOpen.value = true
}

function openEdit(row) {
  editing.value = row
  createAction.clearFieldErrors()
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, props.editForm?.defaults ? props.editForm.defaults(row) : { ...row })
  dialogOpen.value = true
}

/**
 * Create / Update.
 * Loading → API → success (notify → close dialog → reset form → refresh)
 *               → error   (notify → inline field errors → dialog stays open)
 */
async function save() {
  const wasEditing = Boolean(editing.value)
  const payload = { ...form }

  await createAction.run(() => props.submit(payload, editing.value), {
    successMessage: wasEditing
      ? notify.updated(entityName.value)
      : notify.created(entityName.value),
    errorMessage: wasEditing
      ? t('common.unableToSaveEntity', { entity: entityName.value })
      : t('common.unableToSaveEntity', { entity: entityName.value }),
    onSuccess: async () => {
      dialogOpen.value = false
      if (!wasEditing) {
        // Only reset once the backend has confirmed the write.
        editing.value = null
        Object.keys(form).forEach((k) => delete form[k])
        Object.assign(form, props.createForm?.defaults || {})
      }
      await load()
    },
  })
}

/**
 * Archive a single row: confirm → request → ✓ notify → close → refresh.
 * The confirmation dialog owns the loading state and only closes after the
 * backend confirms; a rejection keeps it open and shows the error toast.
 */
async function confirmDestroy(row) {
  if (typeof props.destroy !== 'function') return
  await confirmDelete({
    entity: entityName.value,
    name: rowName(row),
    verb: 'archive',
    okLabel: t('common.archive'),
    busyLabel: t('common.archiving'),
    onConfirm: () => props.destroy(row),
    onConfirmed: async () => {
      notify.success(notify.archived(entityName.value))
      await load()
    },
  })
}

/** Bulk archive: one confirmation, per-row results, partial-failure toast. */
async function bulkDestroy() {
  if (bulkWorking.value || !props.destroy) return
  const targets = [...selected.value]
  if (!targets.length) return

  bulkWorking.value = true
  try {
    const ok = await confirmAction({
      title: t('common.confirmArchiveTitle'),
      message: t('common.bulkArchiveMessage', { n: targets.length }),
      okLabel: t('common.archive'),
      busyLabel: t('common.archiving'),
      icon: 'archive',
      color: 'negative',
      onConfirm: async () => {
        const results = await Promise.allSettled(targets.map((row) => props.destroy(row)))
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length === targets.length) {
          // Nothing succeeded — surface the first failure and keep the selection.
          throw failed[0].reason
        }
        return failed.length
      },
      onConfirmed: async (failedCount) => {
        if (failedCount) {
          notify.warning(t('common.bulkArchivePartial', { ok: targets.length - failedCount, failed: failedCount }))
        } else {
          notify.success(t('common.bulkArchivedSuccess', { n: targets.length }))
        }
        selected.value = []
        await load()
      },
    })
    if (!ok) selected.value = []
  } finally {
    bulkWorking.value = false
  }
}

const entityName = computed(() => props.entityLabel || t('common.entities.record'))

const rowName = (row) => row?.name || row?.title || row?.full_name || `#${row?.id ?? ''}`

function resetFilters() {
  for (const k of Object.keys(filterValues)) filterValues[k] = null
  page.value = 1
  load()
}

load()
</script>

<style lang="sass">
.ku-bulkbar
  display: flex
  align-items: center
  gap: 4px
  padding: 8px 14px
  border-radius: var(--ku-radius-card)
  background: color-mix(in srgb, var(--q-primary) 9%, var(--ku-card-bg))
  border: 1px solid color-mix(in srgb, var(--q-primary) 30%, transparent)
  color: var(--ku-ink)

.view-opt
  color: var(--ku-ink-soft)

  &:hover
    color: var(--q-primary)
    background: color-mix(in srgb, var(--q-primary) 8%, transparent)

.dialog-icon
  background: var(--ku-gold-grad)
  color: #fff

// Fullscreen table surface
.ku-table-fullscreen
  position: fixed
  inset: 0
  z-index: 3000
  background: var(--ku-page-bg)
  overflow: auto
  padding: 16px

  .data-table
    background: var(--ku-card-bg)
</style>

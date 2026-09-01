<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="title" :subtitle="subtitle" :icon="icon">
      <template #actions>
        <slot name="headerActions" />
        <q-btn
          v-if="createForm && canCreate"
          color="primary"
          :icon="createIcon"
          :label="resolvedCreateLabel"
          size="sm"
          data-cy="create-btn"
          @click="openCreate"
        />
      </template>
    </AppPageHeader>

    <!-- Toolbar: search + filters -->
    <div class="row items-center q-col-gutter-sm q-mb-sm">
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
        <q-btn :label="t('common.reset')" outline dense color="grey-7" :disable="!hasActiveFilters" @click="resetFilters" />
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

    <!-- Table -->
    <template v-else>
      <q-table
        :rows="rows"
        :columns="columns"
        row-key="id"
        flat
        bordered
        dense
        :pagination="{ rowsPerPage: perPage }"
        hide-bottom
        wrap-cells
        :no-data-label="emptyMessage || t('common.noData')"
        class="q-mt-sm data-table"
      >
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <slot name="rowActions" :row="props.row" />
            <q-btn
              v-if="editForm && canEdit"
              flat dense round size="sm" color="primary" icon="edit"
              :aria-label="`${t('common.edit')} ${entityLabel}`" data-cy="edit-btn"
              @click="openEdit(props.row)"
            >
              <q-tooltip>{{ t('common.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="destroy && canDelete"
              flat dense round size="sm" color="negative" icon="delete_outline"
              :aria-label="`${t('common.delete')} ${entityLabel}`" data-cy="delete-btn"
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

      <div class="row items-center justify-between q-mt-md q-gutter-sm">
        <div class="text-caption text-grey-6">
          {{ t('common.showingRecords', { count: rows.length, total: total, page: page, pages: Math.max(1, lastPage) }) }}
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
    </template>

    <!-- Create / edit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 420px; max-width: 720px" class="q-dialog-card">
        <q-card-section class="row items-center q-pb-none">
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
                :rules="[(v) => !field.required || (v !== null && v !== undefined && String(v).trim() !== '') || `${field.label} ${t('common.required')}`]"
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
                :multiple="!!field.multiple"
                :use-input="!!field.multiple"
                hide-selected
                :rules="[(v) => !field.required || (field.multiple ? (v && v.length > 0) : !!v) || `${field.label} ${t('common.required')}`]"
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
              />
              <q-toggle
                v-else-if="field.type === 'toggle'"
                v-model="form[field.key]"
                :label="field.label"
              />
            </div>

            <div class="col-12 row justify-end q-gutter-sm">
              <q-btn :label="t('common.cancel')" flat color="grey-7" @click="dialogOpen = false" />
              <q-btn :label="t('common.save')" type="submit" color="primary" :loading="saving" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { useAuthStore } from 'src/stores/auth'

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
})

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()

const rows = ref([])
const total = ref(0)
const lastPage = ref(1)
const page = ref(1)
const perPage = ref(20)
const search = ref('')
const loading = ref(false)
const error = ref('')
const dialogOpen = ref(false)
const editing = ref(null)
const saving = ref(false)

const filterValues = reactive({})
for (const f of props.filters) filterValues[f.key] = null

const canCreate = computed(() => authStore.hasPermission(`${props.perms}.create`))
const canEdit = computed(() => authStore.hasPermission(`${props.perms}.update`))
const canDelete = computed(() => authStore.hasPermission(`${props.perms}.delete`))
const hasActiveFilters = computed(() => Object.values(filterValues).some((v) => v !== null && v !== undefined && v !== ''))
const isEmpty = computed(() => !rows.value.length)

const resolvedCreateLabel = computed(() => props.createLabel || t('common.add'))

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
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

watch(page, load)
watch(search, () => { page.value = 1; load() })
watch(() => props.refreshKey, load)

function openCreate() {
  editing.value = null
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, props.createForm?.defaults || {})
  dialogOpen.value = true
}

function openEdit(row) {
  editing.value = row
  Object.keys(form).forEach((k) => delete form[k])
  Object.assign(form, props.editForm?.defaults ? props.editForm.defaults(row) : { ...row })
  dialogOpen.value = true
}

async function save() {
  saving.value = true
  try {
    await props.submit({ ...form }, editing.value)
    dialogOpen.value = false
    $q.notify({ type: 'positive', message: editing.value ? t('common.updatedSuccess') : t('common.createdSuccess') })
    await load()
  } catch (e) {
    const msg = e.errors ? Object.values(e.errors).flat().join(' · ') : e.message
    $q.notify({ type: 'negative', message: msg || t('common.saveFailed') })
  } finally {
    saving.value = false
  }
}

function confirmDestroy(row) {
  $q.dialog({
    title: t('common.confirmArchiveTitle'),
    message: t('common.confirmArchiveMessage'),
    cancel: true,
    persistent: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      await props.destroy(row)
      $q.notify({ type: 'positive', message: t('common.archivedSuccess') })
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    }
  })
}

function resetFilters() {
  for (const k of Object.keys(filterValues)) filterValues[k] = null
  page.value = 1
  load()
}

load()
</script>

<style lang="sass">
.data-table
  .q-table__card
    border-radius: 8px
</style>

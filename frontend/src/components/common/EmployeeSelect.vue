<template>
  <q-select
    v-model="model"
    v-bind="$attrs"
    :options="options"
    :loading="searching"
    :input-debounce="300"
    use-input
    fill-input
    hide-selected
    map-options
    emit-value
    clearable
    :options-dense="true"
    :error="Boolean(loadError)"
    :error-message="loadError || undefined"
    :no-option-label="searching ? t('common.loading') : t('common.noData')"
    @input-value="onSearch"
    @clear="onClear"
    @popup-show="onReopen"
  >
    <template #prepend><q-icon name="badge" /></template>

    <!-- Empty state: no employees exist yet -->
    <template #no-option>
      <q-item>
        <q-item-section class="text-center text-grey-6">
          <template v-if="searching">{{ t('common.loading') }}</template>
          <template v-else>
            <q-icon name="badge" size="28px" class="q-mb-xs" />
            <div>{{ t('hr.noEmployees') }}</div>
          </template>
        </q-item-section>
      </q-item>
    </template>

    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-avatar size="26px" color="primary" text-color="white" class="text-weight-bold">
            <span class="text-caption">{{ initials(scope.opt.name) }}</span>
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.label }}</q-item-label>
          <q-item-label v-if="scope.opt.department" caption>{{ scope.opt.department }}</q-item-label>
        </q-item-section>
        <q-item-section v-if="scope.opt.status && scope.opt.status !== 'active'" side>
          <q-badge color="grey-6" outline>{{ employeeStatusLabel(scope.opt.status) }}</q-badge>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { employeeService } from 'src/services/employees.service'

/**
 * Employee picker — the single source of truth is the dedicated `employees`
 * table (`GET /employees`). It is NEVER sourced from `users`.
 *
 * - Server-side search as the user types (employee code, name, department…).
 * - Options render as `EMP-001 — Full Name` with the department beneath; the
 *   value submitted to the API is always the employee's database id.
 * - Clearing the field = Unassigned (`null`).
 * - While editing, the currently assigned employee is fetched by id and kept
 *   visible even when it is not part of the current search page.
 * - Loading, empty and error states are handled (an error notification is
 *   raised once if the employees API cannot be reached).
 */
const props = defineProps({
  /** The selected employee's database id (`employees.id`), or null = Unassigned. */
  modelValue: { type: [Number, String], default: null },
  /** Restrict the dropdown to active employees (default true). */
  activeOnly: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'options'])

const { t } = useI18n()
const $q = useQuasar()

const searching = ref(false)
const options = ref([])
const loadError = ref('')
const selectedExtra = ref(null)
let searchSeq = 0
let notifiedError = false

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v ?? null),
})

const initials = (name = '') =>
  String(name).split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()

const employeeStatusLabel = (status) =>
  ({ active: t('hr.active'), inactive: t('hr.inactive'), on_leave: t('hr.onLeave') }[status] || status)

function optionFor(e) {
  return {
    // "EMP-001 — Ahmad Ahmad — IT Department"
    label: [e.employee_code, e.full_name || `${e.first_name} ${e.last_name}`.trim(), e.department_name]
      .filter(Boolean)
      .join(' — '),
    value: e.id,
    name: e.full_name || `${e.first_name} ${e.last_name}`.trim(),
    code: e.employee_code || '',
    department: e.department_name || '',
    status: e.status,
    raw: e,
  }
}

async function onSearch(term) {
  const seq = ++searchSeq
  searching.value = true
  loadError.value = ''
  try {
    const { data } = await employeeService.list({
      search: term || '',
      per_page: 30,
      ...(props.activeOnly ? { status: 'active' } : {}),
    })
    if (seq !== searchSeq) return // a newer search superseded this one
    const rows = data?.data || []
    // Keep a previously selected employee visible even if it is not in the
    // current search results (e.g. while editing an existing record).
    const ids = new Set(rows.map((e) => e.id))
    if (selectedExtra.value && !ids.has(selectedExtra.value.id)) {
      rows.unshift(selectedExtra.value)
    }
    options.value = rows.map(optionFor)
    emit('options', options.value)
  } catch (e) {
    if (seq !== searchSeq) return
    options.value = []
    loadError.value = e?.message || t('common.loadFailed')
    // One clear notification per failure burst — the field itself also shows
    // the error so the user can retry by focusing the field again.
    if (!notifiedError) {
      notifiedError = true
      setTimeout(() => { notifiedError = false }, 4000)
      $q.notify({
        type: 'negative',
        icon: 'cloud_off',
        message: t('hr.employeesLoadFailed'),
        caption: loadError.value,
      })
    }
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

// Reopening the dropdown refreshes the options so newly created employees
// appear without remounting the component.
function onReopen() {
  onSearch('')
}

function onClear() {
  emit('update:modelValue', null)
}

// Track the currently selected employee so it always renders.
watch(
  () => props.modelValue,
  async (id) => {
    if (!id) {
      selectedExtra.value = null
      return
    }
    const known = options.value.find((o) => o.value === id)
    if (known) {
      selectedExtra.value = known.raw
      return
    }
    try {
      const { data } = await employeeService.get(id)
      selectedExtra.value = data
      if (!options.value.some((o) => o.value === id)) {
        options.value = [optionFor(data), ...options.value]
        emit('options', options.value)
      }
    } catch {
      /* stale id — ignore, the field simply shows empty */
    }
  },
  { immediate: true },
)

onSearch('')

onBeforeUnmount(() => {
  searchSeq++ // invalidate in-flight requests
})
</script>

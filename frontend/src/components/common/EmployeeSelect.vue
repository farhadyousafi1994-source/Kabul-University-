<template>
  <q-select
    v-model="model"
    v-bind="$attrs"
    :options="options"
    :loading="searching"
    :input-debounce="350"
    use-input
    fill-input
    hide-selected
    map-options
    emit-value
    clearable
    :options-dense="true"
    :no-option-label="t('common.noData')"
    @input-value="onSearch"
  >
    <template #prepend><q-icon name="badge" /></template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-avatar size="26px" color="primary" text-color="white" class="text-weight-bold">
            <span class="text-caption">{{ initials(scope.opt.label) }}</span>
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.label }}</q-item-label>
          <q-item-label caption>
            {{ [scope.opt.code, scope.opt.department].filter(Boolean).join(' · ') }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { employeeService } from 'src/services/employees.service'

/**
 * Employee picker — sources the dedicated `employees` table.
 *
 * Searches the server as the user types and renders each employee with
 * their employee code and department, so assets can be assigned to the
 * right person unambiguously.
 */
const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
})

const emit = defineEmits(['update:modelValue', 'options'])

const { t } = useI18n()

const searching = ref(false)
const options = ref([])
const selectedExtra = ref(null)

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v ?? null),
})

const initials = (name = '') =>
  String(name).split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()

function optionFor(e) {
  return {
    label: e.full_name || `${e.first_name} ${e.last_name}`.trim(),
    value: e.id,
    code: e.employee_code || '',
    department: e.department_name || '',
    raw: e,
  }
}

async function onSearch(term) {
  searching.value = true
  try {
    const { data } = await employeeService.list({ search: term || '', per_page: 30, status: 'active' })
    const rows = data?.data || []
    // Keep a previously selected employee visible even if it is not in the
    // current search results (e.g. while editing an existing record).
    const ids = new Set(rows.map((e) => e.id))
    if (selectedExtra.value && !ids.has(selectedExtra.value.id)) {
      rows.unshift(selectedExtra.value)
    }
    options.value = rows.map(optionFor)
    emit('options', options.value)
  } catch {
    options.value = []
  } finally {
    searching.value = false
  }
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
      /* stale id — ignore */
    }
  },
  { immediate: true },
)

onSearch('')
</script>

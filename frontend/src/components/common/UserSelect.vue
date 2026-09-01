<template>
  <q-select
    v-model="model"
    v-bind="$attrs"
    :options="options"
    :loading="searching"
    :input-debounce="350"
    use-input
    input-dropdown
    fill-input
    hide-selected
    map-options
    :options-dense="true"
    :no-option-label="t('common.noData')"
    @input-value="onSearch"
  >
    <template #prepend><q-icon name="badge" /></template>
    <template #option="scope">
      <q-item :q-item-scope="scope">
        <q-item-section avatar>
          <q-avatar size="26px" color="primary" text-color="white" class="text-weight-bold">
            <span class="text-caption">{{ initials(scope.opt.label) }}</span>
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.label }}</q-item-label>
          <q-item-label v-if="scope.opt.code" caption>{{ scope.opt.code }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { userService } from 'src/services/users.service'
import { departmentService } from 'src/services/organization.service'

/**
 * Employee picker — always sourced from the employees table (/users).
 *
 * Unlike a plain option list it searches the server as the user types,
 * renders each employee with their department and employee code, and
 * exposes the loaded options so the parent can do lookups.
 */
const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
})

const emit = defineEmits(['update:modelValue', 'options'])

const { t } = useI18n()

const searching = ref(false)
const options = ref([])
const selectedExtra = ref(null)
const departments = ref([])

const deptName = (id) => (departments.value.find((d) => d.id === id) || {}).name || ''

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const initials = (name = '') =>
  String(name).split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()

function optionFor(u) {
  const dept = deptName(u.department_id)
  return {
    label: [u.name, dept].filter(Boolean).join(' — '),
    value: u.id,
    code: u.employee_number || '',
    raw: u,
  }
}

async function onSearch(term) {
  searching.value = true
  try {
    const { data } = await userService.list({ search: term || '', per_page: 30 })
    const rows = data?.data || []
    // Keep a previously selected user visible even if it is not in the
    // current search results (e.g. while editing an existing record).
    const ids = new Set(rows.map((u) => u.id))
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
      const { data } = await userService.get(id)
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

// Initial load: employee list + department names for the option labels.
departmentService.list({ per_page: 100 }).then(({ data }) => {
  departments.value = data?.data || []
}).catch(() => { departments.value = [] })
onSearch('')
</script>

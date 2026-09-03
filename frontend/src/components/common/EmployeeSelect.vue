<template>
  <q-select
    v-bind="passthrough"
    v-model="model"
    :options="options"
    :loading="searching"
    :disable="isDisabled"
    :input-debounce="300"
    use-input
    fill-input
    hide-selected
    map-options
    emit-value
    option-value="value"
    option-label="label"
    clearable
    behavior="menu"
    :options-dense="true"
    :popup-content-style="{ zIndex: 8000 }"
    :error="Boolean(loadError) || Boolean(externalError)"
    :error-message="loadError || externalErrorMessage || undefined"
    :no-option-label="searching ? t('common.loading') : t('hr.noEmployees')"
    @filter="onFilter"
    @clear="onClear"
  >
    <template #prepend><q-icon name="badge" /></template>

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
/**
 * Professional employee picker.
 *
 * Single source of truth: GET /employees (the dedicated `employees` table).
 * Never loads from `users`. The submitted value is always `employees.id`
 * (or `null` when cleared / unassigned).
 *
 * Labels render as:  EMP-001 — Ahmad Ahmad — IT Department
 */
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { employeeService } from 'src/services/employees.service'
import { notify } from 'src/utils/notify'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  /** Selected `employees.id`, or null = Unassigned. */
  modelValue: { type: [Number, String], default: null },
  /** Restrict the dropdown to active employees (default true). */
  activeOnly: { type: Boolean, default: true },
  disable: { type: Boolean, default: false },
})

const attrs = useAttrs()
const externalError = computed(() => attrs.error || false)
const externalErrorMessage = computed(() => attrs['error-message'] || attrs.errorMessage || '')

const passthrough = computed(() => {
  const {
    error,
    'error-message': errorMessage,
    errorMessage: errorMessage2,
    disable,
    ...rest
  } = attrs
  return rest
})

const emit = defineEmits(['update:modelValue', 'options'])

const { t } = useI18n()

const searching = ref(false)
const options = ref([])
const loadError = ref('')
const selectedExtra = ref(null)
let searchSeq = 0
let notifiedError = false

const model = computed({
  get: () => (props.modelValue === '' || props.modelValue == null ? null : Number(props.modelValue)),
  set: (v) => emit('update:modelValue', v == null || v === '' ? null : Number(v)),
})

const isDisabled = computed(() => Boolean(props.disable || attrs.disable))

const initials = (name = '') =>
  String(name).split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase()

const employeeStatusLabel = (status) =>
  ({ active: t('hr.active'), inactive: t('hr.inactive'), on_leave: t('hr.onLeave') }[status] || status)

function optionFor(e) {
  const name = e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim()
  return {
    label: [e.employee_code, name, e.department_name].filter(Boolean).join(' — '),
    value: Number(e.id),
    name,
    code: e.employee_code || '',
    department: e.department_name || '',
    status: e.status,
    raw: e,
  }
}

function extractRows(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.data?.data)) return payload.data.data
  return []
}

function mergeSelected(rows) {
  const list = [...rows]
  const extra = selectedExtra.value
  if (extra && !list.some((e) => Number(e.id) === Number(extra.id))) {
    list.unshift(extra)
  }
  return list
}

/**
 * Results cache, keyed by search term.
 *
 * Without it every keystroke — and every reopen of the menu — replaced
 * `options` with a brand-new array. Quasar then rebuilt the whole menu, which
 * is what produced the blinking, the dropdown closing itself and the input
 * appearing to reset mid-typing. A cache hit now renders synchronously, so
 * repeating a search or reopening the menu causes no visible work at all.
 */
const cache = new Map()
const CACHE_MAX = 30

function cacheKey(term) {
  return `${props.activeOnly ? 'active' : 'all'}::${term}`
}

/** Fetch (or reuse) the option list for `term`. Never mutates `options`. */
async function fetchOptions(term = '') {
  const key = cacheKey(term)
  if (cache.has(key)) return cache.get(key)

  const payload = await employeeService.list({
    search: term || '',
    per_page: 50,
    ...(props.activeOnly ? { status: 'active' } : {}),
  })
  const list = mergeSelected(extractRows(payload)).map(optionFor)
  cache.set(key, list)
  // Bounded so a long typing session cannot grow without limit.
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
  return list
}

/**
 * Quasar calls `filter(value, update, abort)`. Everything that touches
 * `options` must happen INSIDE the `update` callback — that is the only point
 * at which Quasar expects the list to change, and doing it outside is what
 * made the menu flicker and close.
 *
 * After a selection, `fill-input` writes the LABEL into the field. Searching
 * for that full "CODE — Name — Dept" string would match nothing and empty the
 * menu, so we treat it as an unfiltered listing.
 */
function onFilter(val, update, abort) {
  const term = String(val ?? '').trim()
  const selectedLabel = options.value.find((o) => Number(o.value) === Number(model.value))?.label
  const query = selectedLabel && term === selectedLabel ? '' : term

  // Cache hit: update synchronously — no loading flash, no rebuild.
  const key = cacheKey(query)
  if (cache.has(key)) {
    update(() => { options.value = cache.get(key) })
    return
  }

  const seq = ++searchSeq
  searching.value = true
  loadError.value = ''

  fetchOptions(query)
    .then((list) => {
      if (seq !== searchSeq) return abort()
      update(() => { options.value = list; emit('options', list) })
    })
    .catch((e) => {
      if (seq !== searchSeq) return abort()
      loadError.value = e?.message || t('common.loadFailed')
      update(() => {
        options.value = selectedExtra.value ? [optionFor(selectedExtra.value)] : []
      })
      if (!notifiedError) {
        notifiedError = true
        setTimeout(() => { notifiedError = false }, 4000)
        notify.error(t('hr.employeesLoadFailed'), { caption: loadError.value })
      }
    })
    .finally(() => {
      if (seq === searchSeq) searching.value = false
    })
}

/** Initial / programmatic load, used outside the filter lifecycle. */
async function loadEmployees(term = '') {
  const seq = ++searchSeq
  searching.value = true
  loadError.value = ''
  try {
    const list = await fetchOptions(term)
    if (seq !== searchSeq) return
    options.value = list
    emit('options', list)
  } catch (e) {
    if (seq !== searchSeq) return
    options.value = selectedExtra.value ? [optionFor(selectedExtra.value)] : []
    loadError.value = e?.message || t('common.loadFailed')
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

function onClear() {
  selectedExtra.value = null
  cache.clear()
  emit('update:modelValue', null)
}

watch(
  () => props.modelValue,
  async (id) => {
    if (id == null || id === '') {
      selectedExtra.value = null
      return
    }
    const numericId = Number(id)
    const known = options.value.find((o) => Number(o.value) === numericId)
    if (known) {
      selectedExtra.value = known.raw
      return
    }
    try {
      const payload = await employeeService.get(numericId)
      const row = payload?.data && !Array.isArray(payload.data) && payload.data.id
        ? payload.data
        : payload
      if (!row?.id) return
      selectedExtra.value = row
      if (!options.value.some((o) => Number(o.value) === numericId)) {
        options.value = [optionFor(row), ...options.value]
        emit('options', options.value)
      }
    } catch {
      /* stale id — the field simply shows empty */
    }
  },
  { immediate: true },
)

loadEmployees('')

onBeforeUnmount(() => {
  searchSeq += 1
  cache.clear()
})
</script>

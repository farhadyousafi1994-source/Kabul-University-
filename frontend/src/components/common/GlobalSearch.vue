<template>
  <div ref="root" class="gsearch" :class="{ 'gsearch--open': open }">
    <div class="gsearch__field" @click="focusInput">
      <q-icon name="search" size="18px" class="gsearch__icon" />
      <input
        ref="input"
        v-model="term"
        type="text"
        class="gsearch__input"
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.placeholder')"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="String(open)"
        @focus="open = true"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="choose()"
        @keydown.esc.prevent="close(true)"
      />
      <q-spinner v-if="loading" size="16px" class="gsearch__spinner" />
      <button v-else-if="term" type="button" class="gsearch__clear" :aria-label="t('common.reset')" @click.stop="reset">
        <q-icon name="close" size="16px" />
      </button>
      <kbd v-else class="gsearch__kbd">{{ shortcutLabel }}</kbd>
    </div>

    <div v-if="open" class="gsearch__panel" role="listbox">
      <div v-if="term.length < 2" class="gsearch__hint">{{ t('search.typeToSearch') }}</div>

      <template v-else-if="flat.length">
        <template v-for="group in groups" :key="group.key">
          <div class="gsearch__group">{{ groupLabel(group.key) }}</div>
          <button
            v-for="item in group.items"
            :key="`${group.key}-${item.id}`"
            type="button"
            class="gsearch__item"
            :class="{ 'is-active': flat[cursor] && flat[cursor].uid === item.uid }"
            role="option"
            :aria-selected="flat[cursor] && flat[cursor].uid === item.uid"
            @mouseenter="cursor = flat.findIndex((f) => f.uid === item.uid)"
            @click="go(item)"
          >
            <q-icon :name="groupIcon(group.key)" size="18px" class="gsearch__item-icon" />
            <span class="gsearch__item-text">
              <span class="gsearch__item-title">{{ item.title }}</span>
              <span v-if="item.subtitle" class="gsearch__item-sub">{{ item.subtitle }}</span>
            </span>
            <q-icon name="north_east" size="14px" class="gsearch__item-go" />
          </button>
        </template>
      </template>

      <div v-else-if="!loading" class="gsearch__hint">
        <q-icon name="search_off" size="20px" />
        {{ t('search.noResults', { term }) }}
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * GlobalSearch — one search box for the whole application.
 * ---------------------------------------------------------------------------
 *
 * Searches assets, employees, assignments, categories, departments, rooms,
 * suppliers and users through a single aggregated endpoint (`GET /search`), and
 * also matches the application's own PAGES so the box doubles as a command bar.
 *
 * Performance and stability:
 *   • debounced (250 ms) — typing does not fire a request per keystroke,
 *   • the previous request is ABORTED when a newer one starts, so results can
 *     never arrive out of order and overwrite fresher ones,
 *   • results are keyed and rendered from a flat list, so the panel never
 *     re-creates its DOM mid-keystroke (no flicker),
 *   • permission-aware: the API only returns record types the user may view,
 *     and page results are filtered against the router's permission meta.
 *
 * Keyboard: ↑/↓ move · Enter opens · Esc closes · Ctrl/⌘+K focuses.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { statisticsService } from 'src/services/statistics.service'

const { t, te } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const root = ref(null)
const input = ref(null)
const term = ref('')
const open = ref(false)
const loading = ref(false)
const groups = ref([])
const cursor = ref(0)

let controller = null
let timer = null

const shortcutLabel = computed(() =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘K' : 'Ctrl K',
)

// --- pages (client-side, from the router table) ------------------------------
const pages = computed(() =>
  router.getRoutes()
    .filter((r) => r.meta?.title && !r.meta?.hidden && r.name)
    .filter((r) => !r.meta.permission || auth.hasPermission(r.meta.permission))
    .map((r) => ({
      id: r.name,
      title: r.meta.titleKey && te(r.meta.titleKey) ? t(r.meta.titleKey) : r.meta.title,
      subtitle: r.path,
      route: { name: r.name },
    })),
)

function matchingPages(query) {
  const q = query.toLowerCase()
  return pages.value.filter((p) => p.title.toLowerCase().includes(q) || p.subtitle.includes(q)).slice(0, 5)
}

// --- records (API) -----------------------------------------------------------
async function search() {
  const query = term.value.trim()
  if (query.length < 2) {
    groups.value = []
    loading.value = false
    return
  }

  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal

  loading.value = true
  try {
    const { data } = await statisticsService.search(query, {}, { signal })
    if (signal.aborted) return
    const apiGroups = (data?.groups || []).map((g) => ({
      key: g.key,
      items: g.items.map((item) => ({ ...item, uid: `${g.key}-${item.id}` })),
    }))
    const pageMatches = matchingPages(query)
    if (pageMatches.length) {
      apiGroups.push({ key: 'pages', items: pageMatches.map((p) => ({ ...p, uid: `pages-${p.id}` })) })
    }
    groups.value = apiGroups
    cursor.value = 0
  } catch (e) {
    if (!e?.canceled && !signal.aborted) groups.value = []
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

watch(term, () => {
  open.value = true
  clearTimeout(timer)
  timer = setTimeout(search, 250)
})

const flat = computed(() => groups.value.flatMap((g) => g.items.map((i) => ({ ...i, group: g.key }))))

// --- navigation --------------------------------------------------------------
const ROUTES = {
  assets: (item) => ({ name: 'asset-detail', params: { id: item.id } }),
  employees: (item) => ({ name: 'employee-detail', params: { id: item.id } }),
  assignments: (item) => (item.asset_id ? { name: 'asset-detail', params: { id: item.asset_id } } : { name: 'assignments' }),
  categories: () => ({ name: 'categories' }),
  departments: () => ({ name: 'departments' }),
  rooms: () => ({ name: 'rooms' }),
  suppliers: () => ({ name: 'suppliers' }),
  users: () => ({ name: 'users' }),
}

const GROUP_ICONS = {
  assets: 'inventory_2',
  employees: 'badge',
  assignments: 'assignment_ind',
  categories: 'category',
  departments: 'account_tree',
  rooms: 'meeting_room',
  suppliers: 'local_shipping',
  users: 'group',
  pages: 'article',
}

const groupIcon = (key) => GROUP_ICONS[key] || 'search'
const groupLabel = (key) => (te(`search.groups.${key}`) ? t(`search.groups.${key}`) : key)

function go(item) {
  const target = item.route || ROUTES[item.group]?.(item)
  if (!target) return
  close(false)
  router.push(target)
}

function move(delta) {
  if (!flat.value.length) return
  cursor.value = (cursor.value + delta + flat.value.length) % flat.value.length
}

function choose() {
  const item = flat.value[cursor.value]
  if (item) go(item)
}

function focusInput() {
  input.value?.focus()
}

function reset() {
  term.value = ''
  groups.value = []
  focusInput()
}

function close(keepTerm) {
  open.value = false
  if (!keepTerm) term.value = ''
  input.value?.blur()
}

// --- global affordances ------------------------------------------------------
function onDocumentClick(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = true
    focusInput()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(timer)
  controller?.abort()
})
</script>

<style lang="sass" scoped>
.gsearch
  position: relative
  width: 100%
  max-width: 420px

  &__field
    display: flex
    align-items: center
    gap: 8px
    height: 34px
    padding: 0 10px
    border-radius: var(--app-radius)
    background: rgba(255, 255, 255, .14)
    border: 1px solid rgba(255, 255, 255, .22)
    transition: background .15s ease, border-color .15s ease
    cursor: text

    &:hover
      background: rgba(255, 255, 255, .2)

  &--open &__field
    background: #fff
    border-color: var(--q-primary)

  &__icon,
  &__spinner
    color: rgba(255, 255, 255, .85)
    flex: 0 0 auto

  &--open &__icon,
  &--open &__spinner
    color: var(--app-text-secondary)

  &__input
    flex: 1
    min-width: 0
    border: none
    outline: none
    background: transparent
    font: inherit
    font-size: 13px
    color: #fff

    &::placeholder
      color: rgba(255, 255, 255, .72)

  &--open &__input
    color: var(--app-text-primary)

    &::placeholder
      color: var(--app-text-secondary)

  &__clear
    border: none
    background: transparent
    cursor: pointer
    color: var(--app-text-secondary)
    display: flex
    padding: 0

  &__kbd
    font-size: 10px
    font-weight: 700
    padding: 1px 5px
    border-radius: 5px
    background: rgba(255, 255, 255, .18)
    color: rgba(255, 255, 255, .85)

  &__panel
    position: absolute
    inset-inline-start: 0
    inset-inline-end: 0
    top: calc(100% + 6px)
    z-index: 4000
    max-height: 420px
    overflow-y: auto
    background: var(--app-card)
    border: 1px solid var(--app-border)
    border-radius: var(--app-radius-lg)
    box-shadow: 0 14px 38px rgba(16, 24, 40, .18)
    padding: 6px

  &__group
    font-size: 10.5px
    font-weight: 700
    text-transform: uppercase
    letter-spacing: .6px
    color: var(--app-text-secondary)
    padding: 8px 10px 4px

  &__item
    display: flex
    align-items: center
    gap: 10px
    width: 100%
    text-align: start
    border: none
    background: transparent
    padding: 8px 10px
    border-radius: var(--app-radius)
    cursor: pointer
    font: inherit
    color: var(--app-text-primary)

    &.is-active
      background: color-mix(in srgb, var(--q-primary) 10%, transparent)

  &__item-icon
    color: var(--q-primary)
    flex: 0 0 auto

  &__item-text
    display: flex
    flex-direction: column
    min-width: 0
    flex: 1

  &__item-title
    font-size: 13px
    font-weight: 600
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  &__item-sub
    font-size: 11px
    color: var(--app-text-secondary)
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  &__item-go
    color: var(--app-text-secondary)
    opacity: 0
    transition: opacity .12s ease

  &__item.is-active &__item-go
    opacity: 1

  &__hint
    display: flex
    align-items: center
    justify-content: center
    gap: 6px
    padding: 22px 12px
    font-size: 12.5px
    color: var(--app-text-secondary)
</style>

<template>
  <q-layout view="hHh Lpr lFf">
    <!-- Header ---------------------------------------------------------->
    <q-header elevated class="ku-app-header text-white" height-hint="60">
      <q-toolbar>
        <q-btn flat dense round icon="menu" :aria-label="t('nav.sections.general')" @click="drawerOpen = !drawerOpen" />
        <q-toolbar-title class="row items-center no-wrap">
          <q-icon name="account_balance" size="26px" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium gt-xs">{{ t('common.universityName') }}</span>
          <span class="text-caption q-ml-xs gt-sm ku-header-sub">{{ t('common.appName') }}</span>
        </q-toolbar-title>

        <!-- Global search (Ctrl/⌘ + K) -->
        <GlobalSearch class="ku-header-search gt-sm q-mr-sm" />
        <q-btn flat round icon="search" class="lt-md" :aria-label="t('search.placeholder')" @click="mobileSearchOpen = true" />

        <!-- Language Selector -->
        <LanguageSwitcher flat text-color="white" class="q-mr-xs" />

        <!-- Dark Mode Toggle -->
        <q-btn flat round :icon="isDark ? 'light_mode' : 'dark_mode'" :aria-label="t('auth.toggleDarkMode')" @click="toggleDark">
          <q-tooltip>{{ t('auth.toggleDarkMode') }}</q-tooltip>
        </q-btn>

        <!-- Notifications -->
        <q-btn flat round icon="notifications" :aria-label="t('auth.notifications')">
          <q-badge v-if="notificationStore.unreadCount > 0" color="red" floating>
            {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
          </q-badge>
          <q-menu fit auto-close>
            <q-list style="min-width: 340px; max-height: 420px" class="scroll">
              <q-item class="bg-grey-2">
                <q-item-section>
                  <q-item-label class="text-subtitle2">{{ t('auth.notifications') }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat dense size="sm" color="primary" :label="t('auth.markAllRead')" @click="notificationStore.markAllRead" />
                </q-item-section>
              </q-item>
              <template v-if="notificationStore.items.length">
                <q-item
                  v-for="n in notificationStore.items.slice(0, 8)"
                  :key="n.id"
                  clickable
                  :class="{ 'bg-primary/5': !n.read_at }"
                  @click="notificationStore.markRead(n.id)"
                >
                  <q-item-section avatar>
                    <q-icon :name="notificationIcon(n)" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-body2">{{ n.title }}</q-item-label>
                    <q-item-label caption>{{ n.message }}</q-item-label>
                    <q-item-label caption class="text-caption">{{ timeAgo(n.created_at) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <q-item v-else>
                <q-item-section class="text-center text-grey-6 q-py-md">
                  <q-icon name="notifications_off" size="32px" class="q-mb-sm" />
                  <div>{{ t('auth.noNotifications') }}</div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <!-- User menu -->
        <q-btn round flat class="q-ml-xs">
          <q-avatar size="32px" class="ku-user-avatar">{{ authStore.initials }}</q-avatar>
          <q-menu auto-close>
            <q-list style="min-width: 220px">
              <q-item class="bg-grey-2">
                <q-item-section>
                  <q-item-label class="text-weight-bold">{{ authStore.fullName }}</q-item-label>
                  <q-item-label caption>{{ authStore.user?.email || authStore.user?.username }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-ripple @click="goToTheme">
                <q-item-section avatar><q-icon name="palette" /></q-item-section>
                <q-item-section>{{ t('theme.title') }}</q-item-section>
              </q-item>
              <q-item clickable v-ripple @click="themeOpen = true">
                <q-item-section avatar><q-icon name="contrast" /></q-item-section>
                <q-item-section>{{ t('theme.displayMode') }}</q-item-section>
                <q-item-section side>
                  <q-icon :name="isDark ? 'dark_mode' : 'light_mode'" size="16px" />
                </q-item-section>
              </q-item>
              <q-item clickable v-ripple @click="changePasswordDialog = true">
                <q-item-section avatar><q-icon name="lock" /></q-item-section>
                <q-item-section>{{ t('auth.changePassword') }}</q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-ripple @click="logout">
                <q-item-section avatar><q-icon name="logout" color="negative" /></q-item-section>
                <q-item-section class="text-negative">{{ t('auth.signOut') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- Sidebar ---------------------------------------------------------->
    <q-drawer
      v-model="drawerOpen"
      :mini="miniSidebar"
      show-if-above
      bordered
      :width="drawerWidth"
      :mini-width="76"
      :breakpoint="1024"
      class="ku-drawer"
      :class="{ 'ku-drawer--floating': isFloating }"
    >
      <q-scroll-area class="fit">
        <!-- Brand block -->
        <div class="ku-drawer__brand row items-center no-wrap" :class="miniSidebar ? 'justify-center q-py-md' : 'q-pa-md'">
          <div class="ku-drawer__logo">
            <q-icon name="account_balance" size="22px" />
          </div>
          <div v-if="!miniSidebar" class="q-ml-sm min-width-0">
            <div class="text-subtitle2 text-weight-bold ellipsis">{{ t('common.universityName') }}</div>
            <div class="text-caption text-grey-6 ellipsis">{{ t('common.appName') }}</div>
          </div>
        </div>
        <q-separator />

        <!-- Sidebar menu search -->
        <SidebarSearch v-if="!miniSidebar" v-model="menuFilter" />

        <nav class="ku-nav" :aria-label="t('nav.sections.general')">
          <template v-for="group in visibleMenu" :key="group.key">
            <!-- Single-page modules stay flat links; only real modules with
                 sub-pages become dropdowns. -->
            <router-link
              v-if="group.items.length === 1 && !group.alwaysGroup"
              :to="{ name: group.items[0].name }"
              class="ku-nav__solo"
              :class="{ 'ku-nav__solo--active': route.name === group.items[0].name, 'ku-nav__solo--mini': miniSidebar }"
            >
              <q-icon :name="group.items[0].icon" size="19px" />
              <span v-if="!miniSidebar" class="ku-nav__solo-label">{{ group.items[0].title }}</span>
              <q-tooltip v-if="miniSidebar" anchor="center right" self="center left">{{ group.items[0].title }}</q-tooltip>
            </router-link>

            <SidebarDropdown
              v-else
              :label="group.label"
              :icon="group.icon"
              :items="group.items"
              :mini="miniSidebar"
              :expanded="isExpanded(group.key)"
              @toggle="toggleGroup(group.key)"
            />
          </template>

          <div v-if="!visibleMenu.length" class="ku-nav__empty">
            <q-icon name="search_off" size="20px" />
            {{ t('nav.noMenuResults', { term: menuFilter }) }}
          </div>
        </nav>
      </q-scroll-area>
    </q-drawer>

    <!-- Page -------------------------------------------------------------->
    <q-page-container>
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </q-page-container>

    <q-footer reveal bordered class="ku-footer">
      <q-toolbar class="justify-between">
        <div class="text-caption">© {{ year }} {{ t('common.universityName') }} — {{ t('common.appName') }}</div>
        <div class="text-caption gt-xs">{{ t('common.version') }}</div>
      </q-toolbar>
    </q-footer>

    <!-- Global search on phones — same component, full-width sheet -->
    <q-dialog v-model="mobileSearchOpen" position="top">
      <q-card class="q-dialog-card ku-mobile-search">
        <q-card-section class="q-pa-sm">
          <GlobalSearch />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Change password dialog -->
    <q-dialog v-model="changePasswordDialog">
      <ChangePasswordDialog @done="changePasswordDialog = false" />
    </q-dialog>

    <!-- Display-mode quick picker (light / dark / system) -->
    <q-dialog v-model="themeOpen">
      <q-card style="min-width: 300px" class="q-dialog-card">
        <q-card-section class="row items-center q-pb-none">
          <q-icon name="contrast" color="primary" size="20px" class="q-mr-sm" />
          <div class="text-h6">{{ t('theme.displayMode') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :aria-label="t('common.close')" @click="themeOpen = false" />
        </q-card-section>
        <q-card-section>
          <q-list bordered separator class="rounded-borders">
            <q-item
              v-for="mode in ['light', 'dark', 'system']"
              :key="mode"
              clickable
              v-ripple
              :active="themeStore.settings.mode === mode"
              @click="pickMode(mode)"
            >
              <q-item-section avatar>
                <q-icon :name="modeIcon(mode)" />
              </q-item-section>
              <q-item-section>{{ t(`theme.${mode}`) }}</q-item-section>
              <q-item-section side>
                <q-icon v-if="themeStore.settings.mode === mode" name="check_circle" color="primary" />
              </q-item-section>
            </q-item>
          </q-list>
          <div class="text-caption text-grey-6 q-mt-sm">{{ t('theme.displayModeHint') }}</div>
        </q-card-section>
        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat dense no-caps color="grey-8" :label="t('common.close')" @click="themeOpen = false" />
          <q-btn unelevated dense no-caps color="primary" icon="palette" :label="t('theme.title')" @click="goToTheme" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from 'src/stores/auth'
import { useNotificationStore } from 'src/stores/notifications'
import { useThemeStore } from 'src/stores/theme'
import LanguageSwitcher from 'src/components/common/LanguageSwitcher.vue'
import GlobalSearch from 'src/components/common/GlobalSearch.vue'
import SidebarSearch from 'src/components/common/SidebarSearch.vue'
import SidebarDropdown from 'src/components/common/SidebarDropdown.vue'
import ChangePasswordDialog from 'src/components/auth/ChangePasswordDialog.vue'

const router = useRouter()
const route = useRoute()
const { t, te } = useI18n()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const themeStore = useThemeStore()

const drawerOpen = ref(true)
const changePasswordDialog = ref(false)
const themeOpen = ref(false)
const mobileSearchOpen = ref(false)
const menuFilter = ref('')

// `resolvedMode` collapses `system` into the mode the OS currently reports, so
// the header toggle always flips between two concrete states.
const isDark = computed(() => themeStore.isDark)
const sidebarStyle = computed(() => themeStore.settings.sidebar || 'normal')
const miniSidebar = computed(() => sidebarStyle.value === 'mini')
const drawerWidth = computed(() => (sidebarStyle.value === 'expanded' ? 320 : 264))
const isFloating = computed(() => sidebarStyle.value === 'floating')

const year = new Date().getFullYear()

// The header quick-toggle and the theme centre share one source of truth.
function toggleDark() {
  themeStore.setDisplayMode(isDark.value ? 'light' : 'dark')
}

// ---------------------------------------------------------------------------
// Sidebar menu
// ---------------------------------------------------------------------------
// The menu is DERIVED from the router table (title / icon / section / order /
// permission), so a new route appears in the sidebar automatically and can
// never drift out of sync with the routes that actually exist. Sections with
// more than one page render as collapsible dropdowns; a section with a single
// page (Dashboard) stays a flat link.

/** Icon shown on the collapsed group header, per section key. */
const SECTION_ICONS = {
  'nav.sections.general': 'dashboard',
  'nav.sections.assets': 'inventory_2',
  'nav.sections.hr': 'badge',
  'nav.sections.operations': 'sync_alt',
  'nav.sections.maintenance': 'build',
  'nav.sections.catalog': 'category',
  'nav.sections.organization': 'account_balance',
  'nav.sections.administration': 'settings',
}

const menuGroups = computed(() => {
  const toc = router.getRoutes()
    .filter((r) => r.meta?.title && r.meta?.section && !r.meta?.hidden)
    .filter((r) => !r.meta.permission || authStore.hasPermission(r.meta.permission))
    .sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0))

  const groups = []
  const index = new Map()

  for (const r of toc) {
    const key = r.meta.sectionKey || r.meta.section
    const label = r.meta.sectionKey && te(r.meta.sectionKey) ? t(r.meta.sectionKey) : r.meta.section
    const title = r.meta.titleKey && te(r.meta.titleKey) ? t(r.meta.titleKey) : r.meta.title

    if (!index.has(key)) {
      const entry = { key, label, icon: SECTION_ICONS[key] || 'folder', items: [] }
      index.set(key, entry)
      groups.push(entry)
    }
    index.get(key).items.push({ name: r.name, title, icon: r.meta.icon })
  }

  return groups
})

/** Route name -> section key, so the active parent can auto-expand. */
const groupOfRoute = computed(() => {
  const map = {}
  for (const g of menuGroups.value) for (const i of g.items) map[i.name] = g.key
  return map
})

// Sidebar search: filters items (and their parents) locally — no request, no
// reload, no flicker. Matching groups are expanded automatically; clearing the
// box restores exactly the previous expansion state.
const visibleMenu = computed(() => {
  const term = menuFilter.value.trim().toLowerCase()
  if (!term) return menuGroups.value

  const out = []
  for (const g of menuGroups.value) {
    const groupMatches = g.label.toLowerCase().includes(term)
    const items = groupMatches ? g.items : g.items.filter((i) => i.title.toLowerCase().includes(term))
    // `alwaysGroup` keeps a one-hit section rendered as a labelled group while
    // searching, so the user still sees WHERE the match lives.
    if (items.length) out.push({ ...g, items, alwaysGroup: true })
  }
  return out
})

const expandedGroups = ref(new Set())

function isExpanded(key) {
  // While searching every matching group is open; otherwise the user's own
  // expansion state (seeded with the active route's group) decides.
  if (menuFilter.value.trim()) return true
  return expandedGroups.value.has(key)
}

function toggleGroup(key) {
  const next = new Set(expandedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedGroups.value = next
}

/** Always keep the group that owns the current page open. */
watch(
  () => route.name,
  (name) => {
    const key = groupOfRoute.value[name]
    if (key && !expandedGroups.value.has(key)) {
      expandedGroups.value = new Set([...expandedGroups.value, key])
    }
  },
  { immediate: true },
)

function modeIcon(mode) {
  return { light: 'light_mode', dark: 'dark_mode', system: 'desktop_windows' }[mode] || 'contrast'
}

function pickMode(mode) {
  themeStore.setDisplayMode(mode)
  themeOpen.value = false
}

function goToTheme() {
  themeOpen.value = false
  changePasswordDialog.value = false
  router.push({ name: 'theme' })
}

function notificationIcon(n) {
  return n.icon || 'notifications'
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('common.justNow')
  if (mins < 60) return t('common.minsAgo', { m: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('common.hoursAgo', { h: hours })
  const days = Math.floor(hours / 24)
  return t('common.daysAgo', { d: days })
}

async function logout() {
  await authStore.logout()
  router.push({ name: 'login' })
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    notificationStore.fetchNotifications()
    // Pull the signed-in user's appearance (user → org → app defaults) so a
    // fresh login re-skins the app even on a browser with empty localStorage.
    themeStore.loadTheme({ silent: true })
  }
})
</script>

<style lang="sass">
.ku-header-search
  flex: 1 1 320px
  max-width: 420px

.ku-mobile-search
  width: 96vw
  max-width: 620px

  .gsearch
    max-width: none

  .gsearch__field
    background: var(--app-background)
    border-color: var(--app-border)

  .gsearch__input
    color: var(--app-text-primary)

    &::placeholder
      color: var(--app-text-secondary)

  .gsearch__icon
    color: var(--app-text-secondary)

.ku-nav
  padding: 6px 0 14px

  &__solo
    display: flex
    align-items: center
    gap: 10px
    margin: 0 8px 2px
    padding: 8px 10px
    border-radius: var(--app-radius)
    font-size: 13px
    font-weight: 600
    color: var(--app-text-primary)
    text-decoration: none
    transition: background-color .14s ease, color .14s ease

    &:hover
      background: var(--app-hover)
      text-decoration: none

    &--mini
      justify-content: center

    &--active
      background: color-mix(in srgb, var(--q-primary) 12%, transparent)
      color: var(--q-primary)

  &__solo-label
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  &__empty
    display: flex
    align-items: center
    justify-content: center
    gap: 6px
    padding: 24px 14px
    font-size: 12px
    color: var(--app-text-secondary)
    text-align: center

.ku-header-sub
  color: rgba(255, 255, 255, .72)

.min-width-0
  min-width: 0

.ku-user-avatar
  background: linear-gradient(160deg, #F3D48B 0%, #C8862D 100%)
  color: #0B1626
  font-weight: 800
  box-shadow: 0 2px 8px rgba(200, 134, 45, .4)

.ku-drawer
  background: var(--ku-card-bg)

  &__brand
    border-bottom: 1px solid var(--ku-line)

  &__logo
    width: 38px
    height: 38px
    min-width: 38px
    border-radius: 11px
    display: flex
    align-items: center
    justify-content: center
    background: linear-gradient(160deg, #F3D48B 0%, #C8862D 100%)
    color: #0B1626
    box-shadow: 0 4px 12px rgba(200, 134, 45, .35)

.ku-drawer--floating .q-drawer__content
  margin: 10px
  border-radius: var(--app-radius-lg)
  border: 1px solid var(--app-border)
  overflow: hidden
  box-shadow: var(--ku-shadow-md)

.ku-footer
  background: var(--ku-card-bg)
  color: var(--ku-ink-soft)
</style>

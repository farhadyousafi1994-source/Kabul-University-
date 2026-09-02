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
      :width="264"
      :mini-width="76"
      :breakpoint="1024"
      class="ku-drawer"
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

        <q-list padding class="menu-list">
          <template v-for="section in menuSections" :key="section.label">
            <div v-if="section.label && !miniSidebar" class="text-overline text-grey-6 q-px-md q-mt-md q-mb-xs">
              {{ section.label }}
            </div>
            <q-item
              v-for="item in section.items"
              :key="item.name"
              :to="{ name: item.name }"
              exact
              clickable
              v-ripple
              class="q-mx-sm rounded-borders menu-item"
            >
              <q-item-section avatar class="q-pr-none" :class="{ 'menu-item__icon-only': miniSidebar }">
                <q-icon :name="item.icon" size="20px" />
              </q-item-section>
              <q-item-section v-if="!miniSidebar">{{ item.title }}</q-item-section>
              <q-tooltip v-if="miniSidebar" anchor="bottom start" self="top start">{{ item.title }}</q-tooltip>
            </q-item>
          </template>
        </q-list>
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

    <!-- Change password dialog -->
    <q-dialog v-model="changePasswordDialog">
      <ChangePasswordDialog @done="changePasswordDialog = false" />
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from 'src/stores/auth'
import { useNotificationStore } from 'src/stores/notifications'
import { useThemeStore } from 'src/stores/theme'
import LanguageSwitcher from 'src/components/common/LanguageSwitcher.vue'
import ChangePasswordDialog from 'src/components/auth/ChangePasswordDialog.vue'

const router = useRouter()
const { t, te } = useI18n()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const themeStore = useThemeStore()

const drawerOpen = ref(true)
const changePasswordDialog = ref(false)
const isDark = computed(() => themeStore.settings.mode === 'dark')
const miniSidebar = computed(() => themeStore.settings.sidebar === 'mini')

const year = new Date().getFullYear()

// The header quick-toggle and the theme center share one source of truth.
function toggleDark() {
  themeStore.patch({ mode: isDark.value ? 'light' : 'dark' })
}

// ---------------------------------------------------------------------------
// Sidebar menu — derived dynamically from the router table of contents and
// localized reactively using vue-i18n.
// ---------------------------------------------------------------------------
const menuSections = computed(() => {
  const toc = router.getRoutes()
    .filter((r) => r.meta?.title && r.meta?.section && !r.meta?.hidden)
    .filter((r) => !r.meta.permission || authStore.hasPermission(r.meta.permission))
    .sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0))

  const sections = []
  const index = new Map()
  for (const route of toc) {
    const sectionKey = route.meta.sectionKey
    const sectionLabel = sectionKey && te(sectionKey) ? t(sectionKey) : route.meta.section
    const titleKey = route.meta.titleKey
    const itemTitle = titleKey && te(titleKey) ? t(titleKey) : route.meta.title

    if (!index.has(sectionLabel)) {
      const entry = { label: sectionLabel, items: [] }
      index.set(sectionLabel, entry)
      sections.push(entry)
    }
    index.get(sectionLabel).items.push({
      name: route.name,
      title: itemTitle,
      icon: route.meta.icon,
    })
  }
  return sections
})

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
  }
})
</script>

<style lang="sass">
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

.menu-list .menu-item
  color: var(--ku-ink)
  border-radius: 10px
  margin-bottom: 2px
  transition: background-color .12s ease

  .q-item__section--avatar
    min-width: 34px

  .q-icon
    color: var(--ku-ink-soft)
    transition: color .12s ease

  &:hover
    background: color-mix(in srgb, var(--ku-navy-2) 6%, transparent)

    .q-icon
      color: var(--ku-navy-2)

.menu-item.q-router-link--active
  color: var(--ku-navy-2)
  background: color-mix(in srgb, var(--q-primary) 12%, transparent)
  font-weight: 700

  .q-icon
    color: var(--q-primary)

.body--dark
  .menu-item.q-router-link--active
    color: #fff

.ku-footer
  background: var(--ku-card-bg)
  color: var(--ku-ink-soft)
</style>

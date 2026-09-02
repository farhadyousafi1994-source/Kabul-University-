<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <div class="nf-wrap q-pa-sm">
      <!-- Header ------------------------------------------------------------->
      <AppPageHeader
        :title="t('nav.items.notifications')"
        icon="notifications"
        :meta="unreadMeta"
      >
        <template #actions>
        <q-btn flat round dense icon="more_horiz" color="grey-7">
          <q-menu auto-close>
            <q-list dense style="min-width: 220px">
              <q-item clickable v-ripple @click="markAll" :disable="!unreadCount">
                <q-item-section avatar><q-icon name="done_all" /></q-item-section>
                <q-item-section>{{ t('admin.notifications.markAllRead') }}</q-item-section>
              </q-item>
              <q-item clickable v-ripple @click="clearRead">
                <q-item-section avatar><q-icon name="delete_sweep" /></q-item-section>
                <q-item-section>{{ t('admin.notifications.clearRead') }}</q-item-section>
              </q-item>
              <q-item clickable v-ripple @click="load">
                <q-item-section avatar><q-icon name="refresh" /></q-item-section>
                <q-item-section>{{ t('common.refresh') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        </template>
      </AppPageHeader>

      <!-- Tabs ---------------------------------------------------------------->
      <div class="nf-tabs scroll-x">
        <button class="nf-tab" :class="{ 'nf-tab--on': tab === 'all' }" @click="tab = 'all'">{{ t('common.all') }}</button>
        <button class="nf-tab" :class="{ 'nf-tab--on': tab === 'unread' }" @click="tab = 'unread'">
          {{ t('admin.notifications.unread') }}<span v-if="unreadCount" class="nf-tab__n">{{ unreadCount }}</span>
        </button>
        <button
          v-for="c in visibleCategories"
          :key="c.key"
          class="nf-tab"
          :class="{ 'nf-tab--on': tab === c.key }"
          @click="tab = c.key"
        >{{ t(`admin.notifications.cats.${c.key}`) }}</button>
      </div>

      <!-- List ----------------------------------------------------------------->
      <div class="q-card q-card--flat no-shadow nf-card">
        <div v-if="loading" class="q-pa-md">
          <q-skeleton v-for="i in 5" :key="i" type="rect" height="58px" class="q-mb-sm" />
        </div>
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <template v-else>
          <template v-for="(group, gKey) in groups" :key="gKey">
            <div class="nf-group">{{ t(`admin.notifications.groups.${gKey}`) }}</div>
            <div
              v-for="n in group"
              :key="n.id"
              class="nf-row"
              :class="{ 'nf-row--unread': !n.read_at }"
              @click="markRead(n)"
            >
              <div class="nf-ava" :style="{ background: categoryOf(n).tint }">
                <q-icon :name="n.icon || categoryOf(n).icon" size="24px" :style="{ color: categoryOf(n).color }" />
                <span class="nf-ava__badge" :style="{ background: categoryOf(n).color }">
                  <q-icon :name="categoryOf(n).badge" size="11px" class="text-white" />
                </span>
              </div>
              <div class="nf-row__body">
                <div class="nf-row__text">
                  <span class="nf-row__title">{{ n.title }}</span>
                  <span v-if="n.message" class="nf-row__sub">{{ n.message }}</span>
                </div>
                <div class="nf-row__time" :class="{ 'text-primary text-weight-bold': !n.read_at }">
                  {{ timeAgo(n.created_at) }}
                  <span class="nf-row__type">· {{ t(`admin.notifications.cats.${categoryOf(n).key}`) }}</span>
                </div>
              </div>
              <div class="nf-row__side">
                <span v-if="!n.read_at" class="nf-dot" />
                <q-btn flat round dense size="sm" color="grey-6" icon="more_horiz" class="nf-row__menu" @click.stop>
                  <q-menu auto-close>
                    <q-list dense style="min-width: 200px">
                      <q-item clickable v-ripple @click.stop="markRead(n)" :disable="!n.read_at">
                        <q-item-section avatar><q-icon name="mark_email_read" /></q-item-section>
                        <q-item-section>{{ t('admin.notifications.markRead') }}</q-item-section>
                      </q-item>
                      <q-item clickable v-ripple class="text-negative" @click.stop="removeOne(n)">
                        <q-item-section avatar><q-icon name="delete" /></q-item-section>
                        <q-item-section>{{ t('common.delete') }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </div>
          </template>
          <EmptyState
            v-if="!items.length"
            icon="notifications_off"
            :title="t('nav.noNotifications')"
            :message="t('nav.allCaughtUp')"
          />
        </template>
        <div v-if="items.length" class="nf-foot">
          {{ items.length }} {{ t('admin.notifications.footTotal') }} · {{ unreadCount }} {{ t('admin.notifications.footUnread') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import {
  notificationService, NOTIFICATION_CATEGORIES, notificationCategory,
} from 'src/services/notifications.service'
import { timeAgo } from 'src/utils/format'

const { t } = useI18n()
const $q = useQuasar()

const items = ref([])
const loading = ref(false)
const error = ref('')
const tab = ref('all')

const categoryOrder = Object.keys(NOTIFICATION_CATEGORIES)
const visibleCategories = computed(() =>
  categoryOrder
    .map((key) => ({ key, ...NOTIFICATION_CATEGORIES[key] }))
    .filter((c) => c.types.some((ty) => items.value.some((n) => n.type === ty)))
)

const filtered = computed(() => {
  if (tab.value === 'all') return items.value
  if (tab.value === 'unread') return items.value.filter((n) => !n.read_at)
  const cat = NOTIFICATION_CATEGORIES[tab.value]
  return cat ? items.value.filter((n) => cat.types.includes(n.type)) : items.value
})

const groups = computed(() => {
  const out = { today: [], yesterday: [], earlier: [] }
  const dayMs = 24 * 3600 * 1000
  const now = Date.now()
  const startToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
  for (const n of filtered.value) {
    const ts = new Date(n.created_at).getTime()
    if (ts >= startToday) out.today.push(n)
    else if (ts >= startToday - dayMs) out.yesterday.push(n)
    else out.earlier.push(n)
  }
  return out
})

const unreadCount = computed(() => items.value.filter((n) => !n.read_at).length)
const unreadMeta = computed(() => (unreadCount.value ? [{ icon: 'mark_email_unread', label: String(unreadCount.value) }] : []))

const categoryOf = (n) => notificationCategory(n.type)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await notificationService.list()
    items.value = data?.data || []
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

async function markRead(n) {
  if (n.read_at) return
  n.read_at = new Date().toISOString()
  try {
    await notificationService.markRead(n.id)
  } catch { /* non-critical */ }
}

async function markAll() {
  try {
    await notificationService.markAllRead()
    items.value.forEach((n) => { n.read_at = n.read_at || new Date().toISOString() })
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('admin.notifications.markAllDone') })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  }
}

async function clearRead() {
  $q.dialog({
    title: t('admin.notifications.clearRead'),
    message: t('admin.notifications.clearReadConfirm'),
    cancel: true,
    persistent: true,
    color: 'warning',
  }).onOk(async () => {
    try {
      await notificationService.clearRead()
      items.value = items.value.filter((n) => !n.read_at)
      $q.notify({ type: 'positive', icon: 'check_circle', message: t('admin.notifications.clearedDone') })
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
    }
  })
}

async function removeOne(n) {
  try {
    await notificationService.remove(n.id)
    items.value = items.value.filter((x) => x.id !== n.id)
    $q.notify({ type: 'positive', icon: 'check_circle', message: t('common.deletedSuccessEntity', { entity: t('common.entities.notification') }) })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || t('common.saveFailed') })
  }
}

onMounted(load)
</script>

<style lang="sass" scoped>
.nf-wrap
  max-width: 860px
  margin: 0 auto
  border-radius: 16px
  border: 1px solid rgba(0, 0, 0, .08)
  background: #fff
  box-shadow: 0 2px 10px rgba(0, 0, 0, .04)

.nf-head
  display: flex
  align-items: center
  justify-content: space-between
  padding: 14px 18px 10px

  &__title
    display: flex
    align-items: center
    gap: 10px
    font-size: 17px
    font-weight: 700

    .q-icon
      color: var(--q-primary)

.nf-tabs
  display: flex
  gap: 6px
  padding: 4px 18px 12px
  overflow-x: auto
  scrollbar-width: none

  &::-webkit-scrollbar
    display: none

.nf-tab
  position: relative
  flex-shrink: 0
  border: none
  background: transparent
  padding: 6px 14px
  border-radius: 18px
  font-size: 12px
  font-weight: 600
  color: rgba(0, 0, 0, .62)
  cursor: pointer
  transition: all .15s ease

  &:hover
    background: rgba(0, 0, 0, .05)

  &--on
    background: var(--q-primary)
    color: #fff

  &__n
    margin-inline-start: 6px
    padding: 0 6px
    border-radius: 8px
    background: rgba(0, 0, 0, .12)
    font-size: 10px

  &--on &__n
    background: rgba(255, 255, 255, .25)

.nf-card
  border-radius: 12px
  overflow: hidden
  border: 1px solid rgba(0, 0, 0, .06)

.nf-group
  padding: 8px 16px 4px
  font-size: 11px
  font-weight: 700
  color: #9e9e9e
  background: rgba(0, 0, 0, .02)

.nf-row
  display: flex
  align-items: center
  gap: 12px
  padding: 10px 16px
  border-top: 1px solid rgba(0, 0, 0, .05)
  cursor: pointer
  transition: background .12s ease

  &:hover
    background: rgba(0, 0, 0, .02)

  &--unread
    background: color-mix(in srgb, var(--q-primary) 4%, transparent)

  &__body
    flex: 1
    min-width: 0

  &__text
    display: flex
    flex-direction: column
    gap: 1px
    min-width: 0

  &__title
    font-size: 13px
    font-weight: 600
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  &__sub
    font-size: 11.5px
    color: #757575
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  &__time
    font-size: 11.5px
    color: #9e9e9e
    margin-top: 3px

  &__type
    color: inherit
    opacity: .75
    font-weight: 400

  &__side
    display: flex
    align-items: center
    gap: 6px
    flex-shrink: 0

  &__menu
    font-size: 10px

.nf-ava
  position: relative
  flex-shrink: 0
  width: 46px
  height: 46px
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center

  &__badge
    position: absolute
    bottom: -2px
    inset-inline-end: -2px
    width: 18px
    height: 18px
    border-radius: 50%
    display: flex
    align-items: center
    justify-content: center
    border: 2px solid #fff

.nf-dot
  width: 8px
  height: 8px
  border-radius: 50%
  background: var(--q-primary)
  flex-shrink: 0

.nf-foot
  padding: 10px 16px
  border-top: 1px solid rgba(0, 0, 0, .05)
  font-size: 11.5px
  color: #9e9e9e
  text-align: center

// Dark mode
:global(.body--dark)
  .nf-wrap
    background: $dark-page
    border-color: rgba(255, 255, 255, .12)

  .nf-group
    background: rgba(255, 255, 255, .04)

  .nf-row
    border-top-color: rgba(255, 255, 255, .06)

    &:hover
      background: rgba(255, 255, 255, .04)

  .nf-tab
    color: rgba(255, 255, 255, .65)

    &:hover
      background: rgba(255, 255, 255, .08)

@media (max-width: 599px)
  .nf-row
    padding: 8px 10px
    gap: 8px

  .nf-ava
    width: 40px
    height: 40px
</style>

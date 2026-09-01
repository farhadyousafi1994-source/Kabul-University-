<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader :title="t('controlRoom.title')" :subtitle="t('controlRoom.subtitle')" icon="monitoring">
      <template #actions>
        <q-chip dense color="red-6" text-color="white" class="live-chip">
          <span class="live-dot" />
          {{ t('controlRoom.live') }}
        </q-chip>
        <q-btn flat round dense icon="refresh" color="white" @click="load" :loading="loading">
          <q-tooltip>{{ t('common.refresh') }} — {{ lastUpdateLabel }}</q-tooltip>
        </q-btn>
      </template>
    </AppPageHeader>

    <!-- KPI tiles -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-6 col-sm-4 col-md-2" v-for="tile in tiles" :key="tile.label">
        <div class="cr-tile" :class="`cr-tile--${tile.tone}`">
          <q-icon :name="tile.icon" size="26px" class="cr-tile__icon" />
          <div class="cr-tile__value">{{ tile.value }}</div>
          <div class="cr-tile__label">{{ tile.label }}</div>
        </div>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <!-- Live activity feed -->
      <div class="col-12 col-lg-7">
        <div class="cr-card">
          <div class="cr-card__head">
            <q-icon name="bolt" size="18px" color="primary" />
            <span class="text-weight-bold">{{ t('controlRoom.activity') }}</span>
            <q-space />
            <span class="text-caption text-grey-6">{{ t('controlRoom.lastUpdate') }}: {{ lastUpdateLabel }}</span>
          </div>
          <div class="cr-card__body">
            <div v-if="loading && !activities.length">
              <q-skeleton v-for="i in 4" :key="i" type="rect" height="52px" class="q-mb-sm" />
            </div>
            <div v-else-if="!activities.length" class="text-grey-6 text-center q-pa-md">{{ t('controlRoom.noActivity') }}</div>
            <div v-else>
              <div v-for="(a, i) in activities" :key="i" class="cr-feed">
                <div class="cr-feed__dot" :class="`cr-feed__dot--${toneOf(a.action)}`" />
                <div class="cr-feed__body">
                  <div class="cr-feed__line">
                    <span class="text-weight-semibold">{{ a.user_name || '—' }}</span>
                    <span class="cr-feed__action">{{ a.action }}</span>
                    <span class="cr-feed__entity">{{ a.entity }} {{ a.entity_id ? `#${a.entity_id}` : '' }}</span>
                  </div>
                  <div class="cr-feed__time">{{ timeAgo(a.created_at) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Needs attention -->
      <div class="col-12 col-lg-5">
        <div class="cr-card">
          <div class="cr-card__head">
            <q-icon name="warning_amber" size="18px" color="orange" />
            <span class="text-weight-bold">{{ t('controlRoom.attention') }}</span>
          </div>
          <div class="cr-card__body">
            <div
              v-for="item in attention"
              :key="item.label"
              class="cr-att"
              :class="{ 'cr-att--zero': item.value === 0 }"
              @click="item.to && $router.push({ name: item.to })"
            >
              <q-icon :name="item.icon" size="24px" :color="item.value ? item.color : 'grey-4'" />
              <div class="cr-att__body">
                <div class="cr-att__label">{{ item.label }}</div>
              </div>
              <q-badge :color="item.value ? item.color : 'grey-5'" :text-color="item.value ? 'white' : 'grey-9'">
                {{ item.value }}
              </q-badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import { dashboardService } from 'src/services/dashboard.service'
import { assetRequestService } from 'src/services/operations.service'
import { incidentService } from 'src/services/maintenance.service'
import { notificationService } from 'src/services/notifications.service'
import { timeAgo } from 'src/utils/format'

const { t } = useI18n()

const stats = ref(null)
const activities = ref([])
const pendingApprovals = ref(0)
const openIncidents = ref(0)
const unread = ref(0)
const loading = ref(false)
const lastUpdate = ref(null)

let timer = null

const tiles = computed(() => {
  const s = stats.value || {}
  return [
    { label: t('controlRoom.assetsTotal'), value: s.total_assets ?? 0, icon: 'inventory_2', tone: 'primary' },
    { label: t('controlRoom.assetsAssigned'), value: s.assigned_assets ?? 0, icon: 'assignment_ind', tone: 'teal' },
    { label: t('controlRoom.underMaintenance'), value: s.under_maintenance ?? 0, icon: 'build', tone: 'orange' },
    { label: t('controlRoom.damaged'), value: (s.damaged_assets ?? 0) + (s.lost_assets ?? 0) + (s.stolen_assets ?? 0), icon: 'report_problem', tone: 'red' },
    { label: t('controlRoom.pendingApprovals'), value: pendingApprovals.value, icon: 'how_to_reg', tone: 'indigo' },
    { label: t('controlRoom.unreadNotifications'), value: unread.value, icon: 'notifications_active', tone: 'blue' },
  ]
})

const attention = computed(() => {
  const s = stats.value || {}
  return [
    { label: t('controlRoom.approvalsPending'), value: pendingApprovals.value, icon: 'how_to_reg', color: 'indigo', to: 'requests' },
    { label: t('controlRoom.openWorkOrders'), value: s.open_maintenance ?? 0, icon: 'build_circle', color: 'orange', to: 'maintenance' },
    { label: t('controlRoom.openIncidents'), value: openIncidents.value, icon: 'health_and_safety', color: 'red-6', to: 'incidents' },
    { label: t('controlRoom.warranty'), value: s.expiring_warranties ?? 0, icon: 'verified', color: 'amber-8', to: 'assets' },
    { label: t('controlRoom.unreadNotifications'), value: unread.value, icon: 'notifications_active', color: 'blue-8', to: 'notifications' },
  ]
})

const lastUpdateLabel = computed(() => (lastUpdate.value ? timeAgo(lastUpdate.value) : '—'))

const toneOf = (action) => {
  const a = String(action || '').toLowerCase()
  if (a.includes('delet') || a.includes('reject')) return 'red'
  if (a.includes('creat') || a.includes('add')) return 'green'
  if (a.includes('updat') || a.includes('modif')) return 'blue'
  return 'grey'
}

async function load() {
  loading.value = !stats.value
  try {
    const results = await Promise.allSettled([
      dashboardService.stats(),
      dashboardService.recentActivities(),
      assetRequestService.list({ per_page: 1, status: 'department_approval' }),
      assetRequestService.list({ per_page: 1, status: 'manager_review' }),
      incidentService.list({ per_page: 1, status: 'open' }),
      incidentService.list({ per_page: 1, status: 'investigating' }),
      notificationService.list(),
    ])
    const data = (i) => (results[i].status === 'fulfilled' ? results[i].value.data : null)

    if (data(0)) stats.value = data(0)
    if (data(1)) activities.value = data(1).data || []
    pendingApprovals.value = (data(2)?.meta?.total || 0) + (data(3)?.meta?.total || 0)
    openIncidents.value = (data(4)?.meta?.total || 0) + (data(5)?.meta?.total || 0)
    unread.value = data(6)?.meta?.unread || 0
    lastUpdate.value = new Date().toISOString()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  timer = setInterval(load, 30000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="sass" scoped>
.live-chip
  letter-spacing: 1px
  font-weight: 700

.live-dot
  display: inline-block
  width: 8px
  height: 8px
  border-radius: 50%
  background: #fff
  margin-inline-end: 6px
  animation: cr-pulse 1.4s ease-in-out infinite

@keyframes cr-pulse
  0%, 100%
    opacity: 1
  50%
    opacity: .35

.cr-tile
  border-radius: 14px
  padding: 14px
  background: #fff
  border: 1px solid rgba(0, 0, 0, .07)
  box-shadow: 0 2px 8px rgba(0, 0, 0, .04)
  transition: transform .15s ease, box-shadow .15s ease
  position: relative
  overflow: hidden

  &::before
    content: ''
    position: absolute
    inset-inline-start: 0
    top: 0
    bottom: 0
    width: 4px

  &--primary::before
    background: $primary

  &--teal::before
    background: #00897b

  &--orange::before
    background: #ef6c00

  &--red::before
    background: #e53935

  &--indigo::before
    background: #3949ab

  &--blue::before
    background: #1e88e5

  &:hover
    transform: translateY(-2px)
    box-shadow: 0 6px 16px rgba(0, 0, 0, .08)

  &__icon
    opacity: .85

  &__value
    font-size: 26px
    font-weight: 800
    line-height: 1.1
    margin-top: 6px

  &__label
    font-size: 11.5px
    color: #757575
    margin-top: 2px

.cr-card
  border-radius: 14px
  border: 1px solid rgba(0, 0, 0, .07)
  background: #fff
  overflow: hidden

  &__head
    display: flex
    align-items: center
    gap: 8px
    padding: 12px 16px
    border-bottom: 1px solid rgba(0, 0, 0, .06)
    font-size: 14px

  &__body
    padding: 8px 0 12px

.cr-feed
  display: flex
  gap: 12px
  padding: 9px 16px
  border-bottom: 1px dashed rgba(0, 0, 0, .05)

  &:last-child
    border-bottom: none

  &__dot
    width: 10px
    height: 10px
    border-radius: 50%
    margin-top: 5px
    flex-shrink: 0
    background: #bdbdbd

    &--green
      background: #43a047

    &--blue
      background: #1e88e5

    &--red
      background: #e53935

  &__body
    flex: 1
    min-width: 0

  &__line
    font-size: 13px

  &__action
    color: var(--q-primary)
    font-weight: 700
    margin-inline: 4px

  &__entity
    color: #616161
    font-weight: 600

  &__time
    font-size: 11px
    color: #9e9e9e
    margin-top: 1px

.cr-att
  display: flex
  align-items: center
  gap: 12px
  padding: 12px 16px
  border-bottom: 1px solid rgba(0, 0, 0, .05)
  cursor: pointer
  transition: background .12s ease

  &:hover
    background: rgba(0, 0, 0, .03)

  &:last-child
    border-bottom: none

  &--zero
    opacity: .55
    cursor: default

  &__body
    flex: 1

  &__label
    font-size: 13px
    font-weight: 600

:global(.body--dark)
  .cr-tile,
  .cr-card
    background: $dark-page
    border-color: rgba(255, 255, 255, .12)

  .cr-tile__label,
  .cr-feed__time
    color: #a5a5a5

  .cr-att:hover
    background: rgba(255, 255, 255, .05)

@media (max-width: 599px)
  .cr-tile__value
    font-size: 21px
</style>

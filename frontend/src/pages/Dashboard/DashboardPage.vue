<template>
  <div class="page-container q-pa-md q-pa-lg-md">
    <AppPageHeader
      :title="t('dashboard.title')"
      :subtitle="t('dashboard.subtitle')"
      icon="dashboard"
    >
      <template #actions>
        <q-btn color="primary" icon="refresh" :label="t('common.refresh')" outline size="sm" :loading="dashboardStore.statsLoading" @click="dashboardStore.fetchAll()" />
      </template>
    </AppPageHeader>

    <!-- Loading skeleton -->
    <div v-if="loading" class="row q-col-gutter-md">
      <div v-for="i in 8" :key="i" class="col-6 col-md-3">
        <q-skeleton type="rect" class="stat-card" height="84px" />
      </div>
    </div>

    <template v-else-if="stats">
      <!-- Inventory stats -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.totalAssets')" :value="stats.total_assets" icon="inventory_2" color="primary" />
        </div>
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.available')" :value="stats.available_assets" icon="check_circle" color="positive" />
        </div>
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.assigned')" :value="stats.assigned_assets" icon="assignment_ind" color="info" />
        </div>
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.underMaintenance')" :value="stats.under_maintenance" icon="build" color="warning" />
        </div>
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.damaged')" :value="stats.damaged_assets" icon="report_problem" color="deep-orange" />
        </div>
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.lostStolen')" :value="stats.lost_assets + stats.stolen_assets" icon="search_off" color="grey-8" />
        </div>
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.disposed')" :value="stats.disposed_assets" icon="delete_forever" color="grey-6" />
        </div>
        <div class="col-6 col-md-3">
          <StatCard :label="t('dashboard.users')" :value="stats.total_users" icon="group" color="secondary" />
        </div>
      </div>

      <!-- Financial summary -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-md-4">
          <StatCard :label="t('dashboard.totalPurchaseValue')" :value="formatCurrency(stats.total_purchase_value)" icon="payments" color="primary" small />
        </div>
        <div class="col-12 col-md-4">
          <StatCard :label="t('dashboard.currentAssetValue')" :value="formatCurrency(stats.current_value)" icon="savings" color="positive" small />
        </div>
        <div class="col-12 col-md-4">
          <StatCard :label="t('dashboard.depreciatedValue')" :value="formatCurrency(stats.depreciated_value)" icon="trending_down" color="warning" small />
        </div>
      </div>

      <!-- Charts -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-md-6">
          <q-card class="stat-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('dashboard.assetsByCategory') }}</div>
              <div v-if="dashboardStore.chartsLoading" class="q-pa-md"><q-skeleton type="rect" height="240px" /></div>
              <apexchart
                v-else-if="charts.by_category.length"
                type="donut"
                height="260"
                :options="donutOptions"
                :series="charts.by_category.map((c) => c.value)"
              />
              <EmptyState v-else icon="pie_chart" :title="t('dashboard.noCategoryData')" />
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-6">
          <q-card class="stat-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('dashboard.assetsByStatus') }}</div>
              <div v-if="dashboardStore.chartsLoading" class="q-pa-md"><q-skeleton type="rect" height="240px" /></div>
              <apexchart
                v-else-if="charts.by_status.length"
                type="bar"
                height="260"
                :options="barOptions('status')"
                :series="[{ name: t('dashboard.assetsLabel'), data: charts.by_status.map((s) => s.value) }]"
              />
              <EmptyState v-else icon="bar_chart" :title="t('dashboard.noStatusData')" />
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-6">
          <q-card class="stat-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('dashboard.monthlyAcquisitions') }}</div>
              <div v-if="dashboardStore.chartsLoading" class="q-pa-md"><q-skeleton type="rect" height="240px" /></div>
              <apexchart
                v-else-if="charts.acquisitions.length"
                type="area"
                height="260"
                :options="areaOptions"
                :series="[{ name: t('dashboard.assetsAcquired'), data: charts.acquisitions.map((a) => a.value) }]"
              />
              <EmptyState v-else icon="show_chart" :title="t('dashboard.noAcquisitionData')" />
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-6">
          <q-card class="stat-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('dashboard.maintenanceCostByMonth') }}</div>
              <div v-if="dashboardStore.chartsLoading" class="q-pa-md"><q-skeleton type="rect" height="240px" /></div>
              <apexchart
                v-else-if="charts.maintenance_costs.length"
                type="bar"
                height="260"
                :options="barOptions('cost')"
                :series="[{ name: t('dashboard.costLabel'), data: charts.maintenance_costs.map((c) => c.value) }]"
              />
              <EmptyState v-else icon="request_quote" :title="t('dashboard.noMaintenanceData')" />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Feed widgets -->
      <div class="row q-col-gutter-md">
        <!-- Recent activity -->
        <div class="col-12 col-lg-5">
          <q-card class="stat-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium">{{ t('dashboard.recentActivity') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-none">
              <div v-if="dashboardStore.activitiesLoading" class="q-pa-md">
                <q-skeleton v-for="i in 5" :key="i" type="text" class="q-my-sm" />
              </div>
              <q-list v-else-if="activities.length" dense>
                <q-item v-for="a in activities" :key="a.id" class="q-px-md">
                  <q-item-section avatar>
                    <q-avatar :color="activityColor(a.action)" text-color="white" size="30px">
                      <q-icon :name="activityIcon(a.action)" size="16px" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-body2">
                      <b>{{ a.user_name }}</b> {{ a.action }} <b>{{ a.entity_label || a.module }}</b>
                    </q-item-label>
                    <q-item-label caption>{{ timeAgo(a.created_at) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
              <EmptyState v-else icon="history" :title="t('dashboard.noRecentActivity')" />
            </q-card-section>
          </q-card>
        </div>

        <!-- Upcoming -->
        <div class="col-12 col-lg-7">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-card class="stat-card">
                <q-card-section>
                  <div class="text-subtitle1 text-weight-medium">{{ t('dashboard.upcomingMaintenance') }}</div>
                </q-card-section>
                <q-separator />
                <q-card-section class="q-pa-none">
                  <q-list v-if="upcoming.maintenance.length" dense>
                    <q-item v-for="m in upcoming.maintenance" :key="m.id">
                      <q-item-section>
                        <q-item-label class="text-body2">{{ m.asset_name }}</q-item-label>
                        <q-item-label caption>{{ m.maintenance_type }} · {{ formatDate(m.scheduled_date || m.start_date) }}</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <StatusBadge :value="m.status" />
                      </q-item-section>
                    </q-item>
                  </q-list>
                  <EmptyState v-else icon="build" :title="t('dashboard.noUpcomingMaintenance')" />
                </q-card-section>
              </q-card>
            </div>
            <div class="col-12 col-md-6">
              <q-card class="stat-card">
                <q-card-section>
                  <div class="text-subtitle1 text-weight-medium">{{ t('dashboard.expiringWarranties') }}</div>
                </q-card-section>
                <q-separator />
                <q-card-section class="q-pa-none">
                  <q-list v-if="upcoming.warranties.length" dense>
                    <q-item v-for="w in upcoming.warranties" :key="w.id">
                      <q-item-section>
                        <q-item-label class="text-body2">{{ w.asset_name }}</q-item-label>
                        <q-item-label caption>{{ formatDate(w.warranty_expiry_date) }}</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-chip size="sm" dense :color="daysLeft(w.warranty_expiry_date) <= 30 ? 'negative' : 'warning'" text-color="white">
                          {{ daysLeft(w.warranty_expiry_date) }} {{ t('dashboard.days') }}
                        </q-chip>
                      </q-item-section>
                    </q-item>
                  </q-list>
                  <EmptyState v-else icon="verified" :title="t('dashboard.noExpiringWarranties')" />
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>
      </div>
    </template>

    <ErrorState v-else-if="dashboardStore.error" :message="dashboardStore.error" @retry="dashboardStore.fetchAll()" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import VueApexCharts from 'vue3-apexcharts'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import StatCard from 'src/components/common/StatCard.vue'
import StatusBadge from 'src/components/common/StatusBadge.vue'
import EmptyState from 'src/components/common/EmptyState.vue'
import ErrorState from 'src/components/common/ErrorState.vue'
import { useDashboardStore } from 'src/stores/dashboard'
import { currency, date, timeAgo } from 'src/utils/format'

const { t } = useI18n()
const dashboardStore = useDashboardStore()
dashboardStore.fetchAll()

const stats = computed(() => dashboardStore.stats)
const charts = computed(() => dashboardStore.charts || { by_category: [], by_status: [], acquisitions: [], maintenance_costs: [] })
const activities = computed(() => dashboardStore.activities)
const upcoming = computed(() => dashboardStore.upcoming)
const loading = computed(() => !dashboardStore.stats && !dashboardStore.error)

const formatCurrency = (v) => currency(v)
const formatDate = (v) => date(v)

function daysLeft(dateStr) {
  return Math.max(0, Math.ceil((new Date(dateStr) - Date.now()) / 86400000))
}

const ACTIVITY_META = {
  created: ['add', 'positive'],
  updated: ['edit', 'info'],
  deleted: ['delete', 'negative'],
  assigned: ['assignment_ind', 'primary'],
  returned: ['assignment_return', 'teal'],
  transferred: ['swap_horiz', 'indigo'],
  approved: ['check_circle', 'positive'],
  rejected: ['cancel', 'negative'],
  maintained: ['build', 'warning'],
  disposed: ['delete_forever', 'grey-7'],
}
function activityIcon(action) { return ACTIVITY_META[action]?.[0] || 'history' }
function activityColor(action) { return ACTIVITY_META[action]?.[1] || 'grey-6' }

// ApexCharts options ----------------------------------------------------------
const donutOptions = computed(() => ({
  labels: charts.value.by_category.map((c) => c.label),
  legend: { position: 'bottom' },
  dataLabels: { enabled: false },
  tooltip: { y: { formatter: (v) => `${v}` } },
  plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: t('dashboard.totalDonut') } } } } },
}))

function barOptions(kind) {
  const categories = kind === 'status'
    ? charts.value.by_status.map((s) => s.label)
    : charts.value.maintenance_costs.map((c) => c.label)
  return {
    chart: { toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    dataLabels: { enabled: false },
    xaxis: { categories },
    legend: { show: false },
  }
}

const areaOptions = computed(() => ({
  chart: { toolbar: { show: false }, zoom: { enabled: false } },
  stroke: { curve: 'smooth' },
  dataLabels: { enabled: false },
  xaxis: { categories: charts.value.acquisitions.map((a) => a.label) },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.05 } },
}))
</script>

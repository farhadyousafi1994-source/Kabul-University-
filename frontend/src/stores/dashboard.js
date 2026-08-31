import { defineStore } from 'pinia'
import { dashboardService } from 'src/services/dashboard.service'

/**
 * Dashboard store — statistics, charts and feed data (Module 26).
 * Each data group tracks its own loading/error state so widgets can
 * render independently.
 */
export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    stats: null,
    charts: null,
    activities: [],
    upcoming: { maintenance: [], warranties: [] },

    statsLoading: false,
    chartsLoading: false,
    activitiesLoading: false,
    upcomingLoading: false,

    error: null,
  }),

  actions: {
    async fetchAll() {
      await Promise.allSettled([
        this.fetchStats(),
        this.fetchCharts(),
        this.fetchActivities(),
        this.fetchUpcoming(),
      ])
    },

    async fetchStats() {
      this.statsLoading = true
      try {
        const { data } = await dashboardService.stats()
        this.stats = data
        this.error = null
      } catch (e) {
        this.error = e.message
      } finally {
        this.statsLoading = false
      }
    },

    async fetchCharts() {
      this.chartsLoading = true
      try {
        const { data } = await dashboardService.charts()
        this.charts = data
      } catch (e) {
        this.error = e.message
      } finally {
        this.chartsLoading = false
      }
    },

    async fetchActivities() {
      this.activitiesLoading = true
      try {
        const { data } = await dashboardService.recentActivities()
        this.activities = data.data || data
      } catch (e) {
        this.error = e.message
      } finally {
        this.activitiesLoading = false
      }
    },

    async fetchUpcoming() {
      this.upcomingLoading = true
      try {
        const { data } = await dashboardService.upcoming()
        this.upcoming = data
      } catch (e) {
        this.error = e.message
      } finally {
        this.upcomingLoading = false
      }
    },
  },
})

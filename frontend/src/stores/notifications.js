import { defineStore } from 'pinia'
import { http } from 'src/services/api'

/**
 * In-app notification store (Module 23).
 */
export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
  }),

  getters: {
    unreadCount: (state) => state.items.filter((n) => !n.read_at).length,
  },

  actions: {
    async fetchNotifications() {
      this.loading = true
      this.error = null
      try {
        const { data } = await http.get('/notifications')
        this.items = data.data || data
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    async markRead(id) {
      const item = this.items.find((n) => n.id === id)
      if (!item || item.read_at) return
      item.read_at = new Date().toISOString()
      try {
        await http.post(`/notifications/${id}/read`)
      } catch {
        item.read_at = null
      }
    },

    async markAllRead() {
      this.items.forEach((n) => (n.read_at = n.read_at || new Date().toISOString()))
      try {
        await http.post('/notifications/read-all')
      } catch {
        this.fetchNotifications()
      }
    },
  },
})

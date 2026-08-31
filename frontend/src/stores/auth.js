import { defineStore } from 'pinia'
import { http } from 'src/services/api'
import { setAuthToken } from 'src/boot/axios'

const TOKEN_KEY = 'ku_ams_token'
const USER_KEY = 'ku_ams_user'

/**
 * Authentication store.
 * Manages the session (token + user), login/logout, password change and
 * permission helpers used by the router guard and the UI.
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    fullName: (state) => state.user?.name || state.user?.username || 'User',
    initials: (state) => {
      const name = state.user?.name || state.user?.username || 'U'
      return name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    },
    roles: (state) => state.user?.roles?.map((r) => r.name) || [],
    permissions: (state) => {
      const perms = new Set(state.user?.permissions || [])
      for (const role of state.user?.roles || []) {
        for (const p of role.permissions || []) {
          perms.add(p.name || p)
        }
      }
      return [...perms]
    },
  },

  actions: {
    hasPermission(permission) {
      if (this.roles.includes('Super Admin')) return true
      return this.permissions.includes(permission)
    },

    hasAnyPermission(permissions) {
      return permissions.some((p) => this.hasPermission(p))
    },

    async bootstrap() {
      if (!this.token) {
        setAuthToken(null)
        return
      }
      setAuthToken(this.token)
      try {
        const { data } = await http.get('/me')
        this.user = data.user
        localStorage.setItem(USER_KEY, JSON.stringify(this.user))
      } catch {
        // Stale token — clear the session.
        this.logoutLocal()
      }
    },

    async login(credentials) {
      this.loading = true
      this.error = null
      try {
        const { data } = await http.post('/login', credentials)
        this.token = data.token
        this.user = data.user
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        setAuthToken(data.token)
        return data
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        if (this.token) await http.post('/logout')
      } catch {
        // Even if the server call fails the local session must end.
      } finally {
        this.logoutLocal()
      }
    },

    logoutLocal() {
      this.token = null
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setAuthToken(null)
    },

    async changePassword(payload) {
      const { data } = await http.post('/change-password', payload)
      return data
    },

    setUser(user) {
      this.user = user
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    },
  },
})

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('src/pages/Auth/LoginPage.vue'),
    meta: { requiresAuth: false, title: 'Sign in' },
  },
  {
    path: '/',
    component: () => import('src/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('src/pages/Dashboard/DashboardPage.vue'),
        meta: {
          title: 'Dashboard',
          icon: 'dashboard',
          section: 'General',
          permission: 'dashboard.view',
          order: 10,
        },
      },
      // ------------------------------------------------------------------
      // Module routes are registered here, phase by phase:
      //   Assets, Categories, Assignments, Transfers, Requests (Phases 5-6)
      //   Organization (Phase 4) · Maintenance (Phase 9) · Warehouse (Phase 10)
      //   Procurement (Phase 10) · Audit (Phase 11) · Depreciation/Disposal
      //   (Phase 12) · Users & Roles (Phase 3) · Reports (Phase 14)
      //   Notifications & Activity Logs (Phase 13) · Settings (Phase 15)
      // ------------------------------------------------------------------
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('src/pages/Error/NotFoundPage.vue'),
    meta: { requiresAuth: false, title: 'Page not found' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth !== false && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  if (to.meta.permission && !auth.hasPermission(to.meta.permission)) {
    return { name: 'not-found', query: { denied: '1' } }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} — KU-AMS`
    : 'KU-AMS — Kabul University Asset Management'
})

export default router

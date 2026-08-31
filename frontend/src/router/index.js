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
      // Phase 3 — Users, roles & permissions
      // ------------------------------------------------------------------
      {
        path: 'users',
        name: 'users',
        component: () => import('src/pages/Admin/UsersPage.vue'),
        meta: { title: 'Users', icon: 'group', section: 'Administration', permission: 'users.view', order: 10 },
      },
      {
        path: 'roles',
        name: 'roles',
        component: () => import('src/pages/Admin/RolesPage.vue'),
        meta: { title: 'Roles & Permissions', icon: 'admin_panel_settings', section: 'Administration', permission: 'roles.view', order: 20 },
      },
      // ------------------------------------------------------------------
      // Phase 4 — University organization structure
      // ------------------------------------------------------------------
      {
        path: 'campuses',
        name: 'campuses',
        component: () => import('src/pages/Organization/CampusesPage.vue'),
        meta: { title: 'Campuses', icon: 'location_city', section: 'Organization', permission: 'organization.view', order: 10 },
      },
      {
        path: 'faculties',
        name: 'faculties',
        component: () => import('src/pages/Organization/FacultiesPage.vue'),
        meta: { title: 'Faculties', icon: 'school', section: 'Organization', permission: 'organization.view', order: 20 },
      },
      {
        path: 'departments',
        name: 'departments',
        component: () => import('src/pages/Organization/DepartmentsPage.vue'),
        meta: { title: 'Departments', icon: 'account_tree', section: 'Organization', permission: 'organization.view', order: 30 },
      },
      {
        path: 'buildings',
        name: 'buildings',
        component: () => import('src/pages/Organization/BuildingsPage.vue'),
        meta: { title: 'Buildings', icon: 'apartment', section: 'Organization', permission: 'organization.view', order: 40 },
      },
      {
        path: 'floors',
        name: 'floors',
        component: () => import('src/pages/Organization/FloorsPage.vue'),
        meta: { title: 'Floors', icon: 'stairs', section: 'Organization', permission: 'organization.view', order: 50 },
      },
      {
        path: 'rooms',
        name: 'rooms',
        component: () => import('src/pages/Organization/RoomsPage.vue'),
        meta: { title: 'Rooms', icon: 'meeting_room', section: 'Organization', permission: 'organization.view', order: 60 },
      },
      // ------------------------------------------------------------------
      // Phase 5 — Categories & master data
      // ------------------------------------------------------------------
      {
        path: 'categories',
        name: 'categories',
        component: () => import('src/pages/Catalog/CategoriesPage.vue'),
        meta: { title: 'Asset Categories', icon: 'category', section: 'Catalog', permission: 'categories.view', order: 10 },
      },
      {
        path: 'subcategories',
        name: 'subcategories',
        component: () => import('src/pages/Catalog/SubcategoriesPage.vue'),
        meta: { title: 'Subcategories', icon: 'account_tree', section: 'Catalog', permission: 'categories.view', order: 20 },
      },
      {
        path: 'suppliers',
        name: 'suppliers',
        component: () => import('src/pages/Catalog/SuppliersPage.vue'),
        meta: { title: 'Suppliers', icon: 'local_shipping', section: 'Catalog', permission: 'suppliers.view', order: 30 },
      },
      // ------------------------------------------------------------------
      // Phases 6–10 — Assets, files, assignment, transfer, requests
      // ------------------------------------------------------------------
      {
        path: 'assets',
        name: 'assets',
        component: () => import('src/pages/Assets/AssetsPage.vue'),
        meta: { title: 'Assets', icon: 'inventory_2', section: 'Assets', permission: 'assets.view', order: 10 },
      },
      {
        path: 'assets/:id',
        name: 'asset-detail',
        component: () => import('src/pages/Assets/AssetDetailPage.vue'),
        meta: { hidden: true, title: 'Asset detail', section: 'Assets', permission: 'assets.view' },
      },
      {
        path: 'assignments',
        name: 'assignments',
        component: () => import('src/pages/Assets/AssignmentsPage.vue'),
        meta: { title: 'Assignments', icon: 'assignment_ind', section: 'Assets', permission: 'assets.view', order: 20 },
      },
      {
        path: 'transfers',
        name: 'transfers',
        component: () => import('src/pages/Assets/TransfersPage.vue'),
        meta: { title: 'Transfers', icon: 'swap_horiz', section: 'Assets', permission: 'assets.view', order: 30 },
      },
      {
        path: 'requests',
        name: 'requests',
        component: () => import('src/pages/Assets/RequestsPage.vue'),
        meta: { title: 'Asset Requests', icon: 'request_page', section: 'Assets', permission: 'requests.view', order: 40 },
      },
      // ------------------------------------------------------------------
      // Phases 11–12 — Maintenance & incidents
      // ------------------------------------------------------------------
      {
        path: 'maintenance',
        name: 'maintenance',
        component: () => import('src/pages/Maintenance/MaintenancePage.vue'),
        meta: { title: 'Maintenance', icon: 'build', section: 'Maintenance', permission: 'maintenance.view', order: 10 },
      },
      {
        path: 'incidents',
        name: 'incidents',
        component: () => import('src/pages/Maintenance/IncidentsPage.vue'),
        meta: { title: 'Incidents', icon: 'report_problem', section: 'Maintenance', permission: 'incidents.view', order: 20 },
      },
      // ------------------------------------------------------------------
      // Phases 14–19 — Audit, procurement, warehouse, financial
      // ------------------------------------------------------------------
      {
        path: 'audits',
        name: 'audits',
        component: () => import('src/pages/Audit/AuditsPage.vue'),
        meta: { title: 'Audits', icon: 'fact_check', section: 'Operations', permission: 'audit.view', order: 10 },
      },
      {
        path: 'procurement',
        name: 'procurement',
        component: () => import('src/pages/Procurement/ProcurementPage.vue'),
        meta: { title: 'Procurement', icon: 'shopping_cart', section: 'Operations', permission: 'procurement.view', order: 20 },
      },
      {
        path: 'warehouses',
        name: 'warehouses',
        component: () => import('src/pages/Warehouse/WarehousesPage.vue'),
        meta: { title: 'Warehouses', icon: 'warehouse', section: 'Operations', permission: 'warehouse.view', order: 30 },
      },
      {
        path: 'warehouse-transactions',
        name: 'warehouse-transactions',
        component: () => import('src/pages/Warehouse/WarehouseTransactionsPage.vue'),
        meta: { title: 'Stock Transactions', icon: 'swap_vert', section: 'Operations', permission: 'warehouse.view', order: 40 },
      },
      {
        path: 'depreciation',
        name: 'depreciation',
        component: () => import('src/pages/Financial/DepreciationPage.vue'),
        meta: { title: 'Depreciation', icon: 'trending_down', section: 'Operations', permission: 'depreciation.view', order: 50 },
      },
      {
        path: 'disposals',
        name: 'disposals',
        component: () => import('src/pages/Financial/DisposalsPage.vue'),
        meta: { title: 'Disposals', icon: 'delete_forever', section: 'Operations', permission: 'assets.view', order: 60 },
      },
      // ------------------------------------------------------------------
      // Phases 20–24 — Notifications, activity, reports, settings
      // ------------------------------------------------------------------
      {
        path: 'activity-logs',
        name: 'activity-logs',
        component: () => import('src/pages/Admin/ActivityLogsPage.vue'),
        meta: { title: 'Activity Logs', icon: 'receipt_long', section: 'Administration', permission: 'audit.view', order: 30 },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('src/pages/Admin/NotificationsPage.vue'),
        meta: { title: 'Notifications', icon: 'notifications', section: 'Administration', permission: 'notifications.view', order: 40 },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('src/pages/Reports/ReportsPage.vue'),
        meta: { title: 'Reports', icon: 'bar_chart', section: 'Administration', permission: 'reports.view', order: 50 },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('src/pages/Settings/SettingsPage.vue'),
        meta: { title: 'Settings', icon: 'settings', section: 'Administration', permission: 'settings.manage', order: 60 },
      },
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

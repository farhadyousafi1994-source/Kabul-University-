import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import i18n from 'src/i18n'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('src/pages/Auth/LoginPage.vue'),
    meta: { requiresAuth: false, title: 'Sign in', titleKey: 'auth.signIn' },
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
          titleKey: 'nav.items.dashboard',
          icon: 'dashboard',
          section: 'General',
          sectionKey: 'nav.sections.general',
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
        meta: {
          title: 'Users',
          titleKey: 'nav.items.users',
          icon: 'group',
          section: 'Administration',
          sectionKey: 'nav.sections.administration',
          permission: 'users.view',
          order: 10,
        },
      },
      {
        path: 'roles',
        name: 'roles',
        component: () => import('src/pages/Admin/RolesPage.vue'),
        meta: {
          title: 'Roles & Permissions',
          titleKey: 'nav.items.roles',
          icon: 'admin_panel_settings',
          section: 'Administration',
          sectionKey: 'nav.sections.administration',
          permission: 'roles.view',
          order: 20,
        },
      },
      // ------------------------------------------------------------------
      // Phase 4 — University organization structure
      // ------------------------------------------------------------------
      {
        path: 'campuses',
        name: 'campuses',
        component: () => import('src/pages/Organization/CampusesPage.vue'),
        meta: {
          title: 'Campuses',
          titleKey: 'nav.items.campuses',
          icon: 'location_city',
          section: 'Organization',
          sectionKey: 'nav.sections.organization',
          permission: 'organization.view',
          order: 10,
        },
      },
      {
        path: 'faculties',
        name: 'faculties',
        component: () => import('src/pages/Organization/FacultiesPage.vue'),
        meta: {
          title: 'Faculties',
          titleKey: 'nav.items.faculties',
          icon: 'school',
          section: 'Organization',
          sectionKey: 'nav.sections.organization',
          permission: 'organization.view',
          order: 20,
        },
      },
      {
        path: 'departments',
        name: 'departments',
        component: () => import('src/pages/Organization/DepartmentsPage.vue'),
        meta: {
          title: 'Departments',
          titleKey: 'nav.items.departments',
          icon: 'account_tree',
          section: 'Organization',
          sectionKey: 'nav.sections.organization',
          permission: 'organization.view',
          order: 30,
        },
      },
      {
        path: 'buildings',
        name: 'buildings',
        component: () => import('src/pages/Organization/BuildingsPage.vue'),
        meta: {
          title: 'Buildings',
          titleKey: 'nav.items.buildings',
          icon: 'apartment',
          section: 'Organization',
          sectionKey: 'nav.sections.organization',
          permission: 'organization.view',
          order: 40,
        },
      },
      {
        path: 'floors',
        name: 'floors',
        component: () => import('src/pages/Organization/FloorsPage.vue'),
        meta: {
          title: 'Floors',
          titleKey: 'nav.items.floors',
          icon: 'stairs',
          section: 'Organization',
          sectionKey: 'nav.sections.organization',
          permission: 'organization.view',
          order: 50,
        },
      },
      {
        path: 'rooms',
        name: 'rooms',
        component: () => import('src/pages/Organization/RoomsPage.vue'),
        meta: {
          title: 'Rooms',
          titleKey: 'nav.items.rooms',
          icon: 'meeting_room',
          section: 'Organization',
          sectionKey: 'nav.sections.organization',
          permission: 'organization.view',
          order: 60,
        },
      },
      // ------------------------------------------------------------------
      // Phase 5 — Categories & master data
      // ------------------------------------------------------------------
      {
        path: 'categories',
        name: 'categories',
        component: () => import('src/pages/Catalog/CategoriesPage.vue'),
        meta: {
          title: 'Asset Categories',
          titleKey: 'nav.items.categories',
          icon: 'category',
          section: 'Catalog',
          sectionKey: 'nav.sections.catalog',
          permission: 'categories.view',
          order: 10,
        },
      },
      {
        path: 'subcategories',
        name: 'subcategories',
        component: () => import('src/pages/Catalog/SubcategoriesPage.vue'),
        meta: {
          title: 'Subcategories',
          titleKey: 'nav.items.subcategories',
          icon: 'account_tree',
          section: 'Catalog',
          sectionKey: 'nav.sections.catalog',
          permission: 'categories.view',
          order: 20,
        },
      },
      {
        path: 'suppliers',
        name: 'suppliers',
        component: () => import('src/pages/Catalog/SuppliersPage.vue'),
        meta: {
          title: 'Suppliers',
          titleKey: 'nav.items.suppliers',
          icon: 'local_shipping',
          section: 'Catalog',
          sectionKey: 'nav.sections.catalog',
          permission: 'suppliers.view',
          order: 30,
        },
      },
      // ------------------------------------------------------------------
      // Phases 6–10 — Assets, files, assignment, transfer, requests
      // ------------------------------------------------------------------
      {
        path: 'assets',
        name: 'assets',
        component: () => import('src/pages/Assets/AssetsPage.vue'),
        meta: {
          title: 'Assets',
          titleKey: 'nav.items.assets',
          icon: 'inventory_2',
          section: 'Assets',
          sectionKey: 'nav.sections.assets',
          permission: 'assets.view',
          order: 10,
        },
      },
      {
        path: 'assets/:id',
        name: 'asset-detail',
        component: () => import('src/pages/Assets/AssetDetailPage.vue'),
        meta: {
          hidden: true,
          title: 'Asset detail',
          titleKey: 'nav.items.assetDetail',
          section: 'Assets',
          sectionKey: 'nav.sections.assets',
          permission: 'assets.view',
        },
      },
      {
        path: 'assignments',
        name: 'assignments',
        component: () => import('src/pages/Assets/AssignmentsPage.vue'),
        meta: {
          title: 'Assignments',
          titleKey: 'nav.items.assignments',
          icon: 'assignment_ind',
          section: 'Assets',
          sectionKey: 'nav.sections.assets',
          permission: 'assets.view',
          order: 20,
        },
      },
      {
        path: 'transfers',
        name: 'transfers',
        component: () => import('src/pages/Assets/TransfersPage.vue'),
        meta: {
          title: 'Transfers',
          titleKey: 'nav.items.transfers',
          icon: 'swap_horiz',
          section: 'Assets',
          sectionKey: 'nav.sections.assets',
          permission: 'assets.view',
          order: 30,
        },
      },
      {
        path: 'requests',
        name: 'requests',
        component: () => import('src/pages/Assets/RequestsPage.vue'),
        meta: {
          title: 'Asset Requests',
          titleKey: 'nav.items.requests',
          icon: 'request_page',
          section: 'Assets',
          sectionKey: 'nav.sections.assets',
          permission: 'requests.view',
          order: 40,
        },
      },
      // ------------------------------------------------------------------
      // Phases 11–12 — Maintenance & incidents
      // ------------------------------------------------------------------
      {
        path: 'maintenance',
        name: 'maintenance',
        component: () => import('src/pages/Maintenance/MaintenancePage.vue'),
        meta: {
          title: 'Maintenance',
          titleKey: 'nav.items.maintenance',
          icon: 'build',
          section: 'Maintenance',
          sectionKey: 'nav.sections.maintenance',
          permission: 'maintenance.view',
          order: 10,
        },
      },
      {
        path: 'incidents',
        name: 'incidents',
        component: () => import('src/pages/Maintenance/IncidentsPage.vue'),
        meta: {
          title: 'Incidents',
          titleKey: 'nav.items.incidents',
          icon: 'report_problem',
          section: 'Maintenance',
          sectionKey: 'nav.sections.maintenance',
          permission: 'incidents.view',
          order: 20,
        },
      },
      // ------------------------------------------------------------------
      // Phases 14–19 — Audit, procurement, warehouse, financial
      // ------------------------------------------------------------------
      {
        path: 'audits',
        name: 'audits',
        component: () => import('src/pages/Audit/AuditsPage.vue'),
        meta: {
          title: 'Audits',
          titleKey: 'nav.items.audits',
          icon: 'fact_check',
          section: 'Operations',
          sectionKey: 'nav.sections.operations',
          permission: 'audit.view',
          order: 10,
        },
      },
      {
        path: 'procurement',
        name: 'procurement',
        component: () => import('src/pages/Procurement/ProcurementPage.vue'),
        meta: {
          title: 'Procurement',
          titleKey: 'nav.items.procurement',
          icon: 'shopping_cart',
          section: 'Operations',
          sectionKey: 'nav.sections.operations',
          permission: 'procurement.view',
          order: 20,
        },
      },
      {
        path: 'warehouses',
        name: 'warehouses',
        component: () => import('src/pages/Warehouse/WarehousesPage.vue'),
        meta: {
          title: 'Warehouses',
          titleKey: 'nav.items.warehouses',
          icon: 'warehouse',
          section: 'Operations',
          sectionKey: 'nav.sections.operations',
          permission: 'warehouse.view',
          order: 30,
        },
      },
      {
        path: 'warehouse-transactions',
        name: 'warehouse-transactions',
        component: () => import('src/pages/Warehouse/WarehouseTransactionsPage.vue'),
        meta: {
          title: 'Stock Transactions',
          titleKey: 'nav.items.warehouseTransactions',
          icon: 'swap_vert',
          section: 'Operations',
          sectionKey: 'nav.sections.operations',
          permission: 'warehouse.view',
          order: 40,
        },
      },
      {
        path: 'depreciation',
        name: 'depreciation',
        component: () => import('src/pages/Financial/DepreciationPage.vue'),
        meta: {
          title: 'Depreciation',
          titleKey: 'nav.items.depreciation',
          icon: 'trending_down',
          section: 'Operations',
          sectionKey: 'nav.sections.operations',
          permission: 'depreciation.view',
          order: 50,
        },
      },
      {
        path: 'disposals',
        name: 'disposals',
        component: () => import('src/pages/Financial/DisposalsPage.vue'),
        meta: {
          title: 'Disposals',
          titleKey: 'nav.items.disposals',
          icon: 'delete_forever',
          section: 'Operations',
          sectionKey: 'nav.sections.operations',
          permission: 'assets.view',
          order: 60,
        },
      },
      // ------------------------------------------------------------------
      // Phases 20–24 — Notifications, activity, reports, settings
      // ------------------------------------------------------------------
      {
        path: 'activity-logs',
        name: 'activity-logs',
        component: () => import('src/pages/Admin/ActivityLogsPage.vue'),
        meta: {
          title: 'Activity Logs',
          titleKey: 'nav.items.activityLogs',
          icon: 'receipt_long',
          section: 'Administration',
          sectionKey: 'nav.sections.administration',
          permission: 'audit.view',
          order: 30,
        },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('src/pages/Admin/NotificationsPage.vue'),
        meta: {
          title: 'Notifications',
          titleKey: 'nav.items.notifications',
          icon: 'notifications',
          section: 'Administration',
          sectionKey: 'nav.sections.administration',
          permission: 'notifications.view',
          order: 40,
        },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('src/pages/Reports/ReportsPage.vue'),
        meta: {
          title: 'Reports',
          titleKey: 'nav.items.reports',
          icon: 'bar_chart',
          section: 'Administration',
          sectionKey: 'nav.sections.administration',
          permission: 'reports.view',
          order: 50,
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('src/pages/Settings/SettingsPage.vue'),
        meta: {
          title: 'Settings',
          titleKey: 'nav.items.settings',
          icon: 'settings',
          section: 'Administration',
          sectionKey: 'nav.sections.administration',
          permission: 'settings.manage',
          order: 60,
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('src/pages/Error/NotFoundPage.vue'),
    meta: { requiresAuth: false, title: 'Page not found', titleKey: 'common.pageNotFound' },
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
  const t = i18n.global.t
  const te = i18n.global.te
  const pageTitle = to.meta.titleKey && te(to.meta.titleKey)
    ? t(to.meta.titleKey)
    : (to.meta.title || 'KU-AMS')
  const appTitle = te('common.systemTitle') ? t('common.systemTitle') : 'KU-AMS'

  document.title = `${pageTitle} — ${appTitle}`
})

export default router

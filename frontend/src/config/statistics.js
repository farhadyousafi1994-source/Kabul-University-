/**
 * ---------------------------------------------------------------------------
 * Summary-card registry
 * ---------------------------------------------------------------------------
 *
 * The API returns raw numbers (`{ total: 34, available: 18, … }`); this file
 * says how each one is PRESENTED — label, icon, colour and, when the card is
 * interactive, which table filter clicking it applies.
 *
 * One entry per module. A page only has to name its module:
 *
 *   <StatisticsCards module="assets" :filters="filters" v-model:active="…" />
 *
 * Card shape:
 *   key      the key inside the API `stats` object
 *   labelKey i18n key for the card label
 *   icon     Material icon name
 *   color    Quasar palette colour, chosen by MEANING (positive = good,
 *            warning = needs attention, negative = problem, …)
 *   filter   `{ field: value }` applied to the table when the card is clicked;
 *            omit to make the card informational only
 *   format   'number' (default) or 'currency'
 */

const card = (key, labelKey, icon, color, filter = null, format = 'number') =>
  ({ key, labelKey, icon, color, filter, format })

export const STATISTIC_CARDS = {
  assets: [
    card('total', 'stats.assets.total', 'inventory_2', 'primary'),
    card('available', 'stats.assets.available', 'check_circle', 'positive', { status: 'available' }),
    card('assigned', 'stats.assets.assigned', 'person', 'info', { status: 'assigned' }),
    card('under_maintenance', 'stats.assets.maintenance', 'build', 'warning', { status: 'under_maintenance' }),
    card('damaged', 'stats.assets.damaged', 'report_problem', 'negative', { status: 'damaged' }),
    card('retired', 'stats.assets.retired', 'inventory', 'grey-7', { status: 'retired' }),
    card('total_value', 'stats.assets.value', 'payments', 'secondary', null, 'currency'),
  ],

  employees: [
    card('total', 'stats.employees.total', 'badge', 'primary'),
    card('active', 'stats.employees.active', 'how_to_reg', 'positive', { status: 'active' }),
    card('inactive', 'stats.employees.inactive', 'person_off', 'grey-7', { status: 'inactive' }),
    card('on_leave', 'stats.employees.onLeave', 'event_busy', 'warning', { status: 'on_leave' }),
    card('departments', 'stats.employees.departments', 'account_tree', 'info'),
    card('new_this_month', 'stats.employees.newThisMonth', 'person_add', 'secondary'),
  ],

  assignments: [
    card('total', 'stats.assignments.total', 'assignment', 'primary'),
    card('active', 'stats.assignments.active', 'assignment_turned_in', 'positive', { status: 'active' }),
    card('returned', 'stats.assignments.returned', 'undo', 'info', { status: 'returned' }),
    card('overdue', 'stats.assignments.overdue', 'schedule', 'negative', { status: 'overdue' }),
    card('pending_return', 'stats.assignments.pendingReturn', 'hourglass_bottom', 'warning'),
  ],

  categories: [
    card('total', 'stats.categories.total', 'category', 'primary'),
    card('active', 'stats.categories.active', 'check_circle', 'positive', { status: 'active' }),
    card('with_assets', 'stats.categories.withAssets', 'inventory_2', 'info'),
    card('empty', 'stats.categories.empty', 'inbox', 'grey-7'),
  ],

  subcategories: [
    card('total', 'stats.categories.totalSub', 'account_tree', 'primary'),
    card('active', 'stats.categories.active', 'check_circle', 'positive', { status: 'active' }),
    card('with_assets', 'stats.categories.withAssets', 'inventory_2', 'info'),
    card('empty', 'stats.categories.empty', 'inbox', 'grey-7'),
  ],

  users: [
    card('total', 'stats.users.total', 'group', 'primary'),
    card('active', 'stats.users.active', 'verified_user', 'positive', { status: 'active' }),
    card('inactive', 'stats.users.inactive', 'no_accounts', 'grey-7', { status: 'inactive' }),
    card('administrators', 'stats.users.administrators', 'admin_panel_settings', 'warning'),
    card('roles', 'stats.users.roles', 'shield', 'info'),
  ],

  suppliers: [
    card('total', 'stats.suppliers.total', 'local_shipping', 'primary'),
    card('active', 'stats.suppliers.active', 'check_circle', 'positive', { status: 'active' }),
    card('inactive', 'stats.suppliers.inactive', 'block', 'grey-7', { status: 'inactive' }),
    card('with_assets', 'stats.suppliers.withAssets', 'inventory_2', 'info'),
  ],

  maintenance: [
    card('total', 'stats.maintenance.total', 'build', 'primary'),
    card('requested', 'stats.maintenance.requested', 'pending_actions', 'warning', { status: 'requested' }),
    card('in_progress', 'stats.maintenance.inProgress', 'engineering', 'info', { status: 'in_progress' }),
    card('completed', 'stats.maintenance.completed', 'task_alt', 'positive', { status: 'completed' }),
    card('total_cost', 'stats.maintenance.cost', 'payments', 'secondary', null, 'currency'),
  ],

  incidents: [
    card('total', 'stats.incidents.total', 'report', 'primary'),
    card('open', 'stats.incidents.open', 'error_outline', 'negative', { status: 'reported' }),
    card('resolved', 'stats.incidents.resolved', 'task_alt', 'positive', { status: 'resolved' }),
    card('closed', 'stats.incidents.closed', 'lock', 'grey-7', { status: 'closed' }),
  ],

  transfers: [
    card('total', 'stats.transfers.total', 'swap_horiz', 'primary'),
    card('pending', 'stats.transfers.pending', 'pending', 'warning', { status: 'pending' }),
    card('approved', 'stats.transfers.approved', 'thumb_up', 'info', { status: 'approved' }),
    card('completed', 'stats.transfers.completed', 'task_alt', 'positive', { status: 'completed' }),
  ],

  requests: [
    card('total', 'stats.requests.total', 'request_page', 'primary'),
    card('pending', 'stats.requests.pending', 'pending', 'warning', { status: 'pending' }),
    card('approved', 'stats.requests.approved', 'thumb_up', 'positive', { status: 'approved' }),
    card('rejected', 'stats.requests.rejected', 'thumb_down', 'negative', { status: 'rejected' }),
  ],

  audits: [
    card('total', 'stats.audits.total', 'fact_check', 'primary'),
    card('planned', 'stats.audits.planned', 'event', 'info', { status: 'planned' }),
    card('in_progress', 'stats.audits.inProgress', 'pending_actions', 'warning', { status: 'in_progress' }),
    card('completed', 'stats.audits.completed', 'task_alt', 'positive', { status: 'completed' }),
  ],

  disposals: [
    card('total', 'stats.disposals.total', 'delete_forever', 'primary'),
    card('completed', 'stats.disposals.completed', 'task_alt', 'positive', { status: 'completed' }),
    card('pending', 'stats.disposals.pending', 'pending', 'warning', { status: 'pending' }),
    card('proceeds', 'stats.disposals.proceeds', 'payments', 'secondary', null, 'currency'),
  ],

  warehouses: [
    card('total', 'stats.warehouses.total', 'warehouse', 'primary'),
    card('active', 'stats.warehouses.active', 'check_circle', 'positive', { status: 'active' }),
    card('inactive', 'stats.warehouses.inactive', 'block', 'grey-7', { status: 'inactive' }),
    card('transactions', 'stats.warehouses.transactions', 'sync_alt', 'info'),
  ],

  procurement: [
    card('total', 'stats.procurement.orders', 'shopping_cart', 'primary'),
    card('requests', 'stats.procurement.requests', 'request_quote', 'info'),
    card('sent', 'stats.procurement.sent', 'send', 'warning'),
    card('received', 'stats.procurement.received', 'inventory', 'positive'),
    card('value', 'stats.procurement.value', 'payments', 'secondary', null, 'currency'),
  ],

  activity: [
    card('total', 'stats.activity.total', 'history', 'primary'),
    card('today', 'stats.activity.today', 'today', 'info'),
    card('this_week', 'stats.activity.thisWeek', 'date_range', 'secondary'),
    card('users', 'stats.activity.users', 'group', 'positive'),
  ],
}

// Organization modules share one presentation.
const ORG_LABELS = {
  campuses: 'stats.organization.campuses',
  faculties: 'stats.organization.faculties',
  departments: 'stats.organization.departments',
  buildings: 'stats.organization.buildings',
  floors: 'stats.organization.floors',
  rooms: 'stats.organization.rooms',
}
const ORG_ICONS = {
  campuses: 'location_city',
  faculties: 'school',
  departments: 'account_tree',
  buildings: 'apartment',
  floors: 'stairs',
  rooms: 'meeting_room',
}
for (const [module, labelKey] of Object.entries(ORG_LABELS)) {
  STATISTIC_CARDS[module] = [
    card('total', labelKey, ORG_ICONS[module], 'primary'),
    card('active', 'stats.common.active', 'check_circle', 'positive', { status: 'active' }),
    card('with_assets', 'stats.common.withAssets', 'inventory_2', 'info'),
    card('empty', 'stats.common.empty', 'inbox', 'grey-7'),
  ]
}

export function cardsFor(module) {
  return STATISTIC_CARDS[module] || []
}

export default STATISTIC_CARDS

/**
 * ---------------------------------------------------------------------------
 * Report catalog — the semantic layer AND the security allowlist
 * ---------------------------------------------------------------------------
 *
 * Every report the Advanced Report Generator can produce is expressed as a
 * structured Report Query Object:
 *
 *   { module, mode, metrics[], dimensions[], fields[], dateField,
 *     filters{}, sort{}, limit }
 *
 * Nothing else ever reaches the database. A question typed by a user is turned
 * into that object on the client, and this catalog is what decides whether the
 * object is allowed:
 *
 *   · `module`     must be a key of DATASETS
 *   · `metrics`    must be keys of dataset.metrics
 *   · `dimensions` must be keys of dataset.dimensions
 *   · `fields`     must be keys of dataset.fields
 *   · `filters`    must be keys of dataset.filters, with an allowed operator
 *   · every value is bound as a SQL parameter — never interpolated
 *
 * SQL fragments live HERE, on the server, and are static strings written by
 * hand. The client never sends SQL, table names or column names of its own.
 *
 * `permission` on a dataset / metric is checked against the caller's effective
 * permissions before the query is built (see engine.js).
 *
 * Adding a new reportable module = adding one entry below (+ label keys in
 * `src/i18n/reports.extensions.js`). No UI change is required.
 * ---------------------------------------------------------------------------
 */

/** Operators a filter may use, per value type. */
export const OPERATORS = {
  text: ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty', 'in'],
  enum: ['eq', 'neq', 'in', 'is_empty', 'is_not_empty'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty', 'is_not_empty'],
  date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty', 'is_not_empty'],
}

/** Aggregations a builder metric may declare. */
export const AGGREGATIONS = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max']

/** Named, relative date ranges understood by both the NLU and the builder. */
export const DATE_PRESETS = [
  'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month',
  'this_quarter', 'this_year', 'last_year', 'last_7_days', 'last_30_days',
  'last_90_days', 'last_6_months', 'last_12_months', 'next_30_days',
  'next_90_days', 'all_time', 'custom',
]

/** Chart types the client may render (validated so saved reports stay sane). */
export const CHART_TYPES = ['auto', 'bar', 'column', 'line', 'area', 'pie', 'donut', 'table']

/** Hard safety limits — a report can never ask for more than this. */
export const LIMITS = { default: 50, max: 1000, detailMax: 1000 }

// ---------------------------------------------------------------------------
// Reusable SQL join fragments
// ---------------------------------------------------------------------------

const j = {
  category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
  subcategory: 'LEFT JOIN asset_subcategories sc ON sc.id = a.subcategory_id',
  supplier: 'LEFT JOIN suppliers s ON s.id = a.supplier_id',
  campus: 'LEFT JOIN campuses cm ON cm.id = a.campus_id',
  faculty: 'LEFT JOIN faculties f ON f.id = a.faculty_id',
  department: 'LEFT JOIN departments d ON d.id = a.department_id',
  building: 'LEFT JOIN buildings b ON b.id = a.building_id',
  room: 'LEFT JOIN rooms rm ON rm.id = a.room_id',
  employee: 'LEFT JOIN employees e ON e.id = a.employee_id',
}

/** Day/week/month/quarter/year buckets over the dataset's active date field. */
const TIME_BUCKETS = {
  day: { sql: (d) => `date(${d})`, labelKey: 'reports.fields.day' },
  week: { sql: (d) => `strftime('%Y-W%W', ${d})`, labelKey: 'reports.fields.week' },
  month: { sql: (d) => `strftime('%Y-%m', ${d})`, labelKey: 'reports.fields.month' },
  quarter: { sql: (d) => `strftime('%Y', ${d}) || '-Q' || ((CAST(strftime('%m', ${d}) AS INTEGER) + 2) / 3)`, labelKey: 'reports.fields.quarter' },
  year: { sql: (d) => `strftime('%Y', ${d})`, labelKey: 'reports.fields.year' },
}

export const TIME_DIMENSIONS = Object.keys(TIME_BUCKETS)

/** Shorthand builders keep the dataset definitions readable. */
const dim = (expr, labelKey, extra = {}) => ({ expr, labelKey, ...extra })
const met = (expr, labelKey, format = 'number', extra = {}) => ({ expr, labelKey, format, ...extra })
const money = (expr, labelKey, extra = {}) => met(expr, labelKey, 'currency', { financial: true, ...extra })
const fld = (expr, labelKey, format = 'text', extra = {}) => ({ expr, labelKey, format, ...extra })
const flt = (expr, labelKey, type = 'text', extra = {}) => ({ expr, labelKey, type, ...extra })

const ASSET_STATUSES = ['available', 'assigned', 'under_maintenance', 'damaged', 'lost', 'disposed', 'reserved']
const CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged']

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export const DATASETS = {
  // -------------------------------------------------------------- assets ---
  assets: {
    id: 'assets',
    labelKey: 'reports.modules.assets',
    descriptionKey: 'reports.modules.assetsDesc',
    icon: 'inventory_2',
    accent: 'blue',
    permission: 'assets.view',
    from: 'assets a',
    baseWhere: ['a.deleted_at IS NULL'],
    scope: { department: 'a.department_id', campus: 'a.campus_id' },
    dates: {
      purchase_date: { expr: 'a.purchase_date', labelKey: 'reports.fields.purchaseDate' },
      warranty_expiry_date: { expr: 'a.warranty_expiry_date', labelKey: 'reports.fields.warrantyExpiry' },
      created_at: { expr: 'a.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'purchase_date',
    dimensions: {
      category: dim('c.name', 'reports.fields.category', { needs: ['category'] }),
      subcategory: dim('sc.name', 'reports.fields.subcategory', { needs: ['subcategory'] }),
      status: dim('a.status', 'reports.fields.status', { translate: 'status' }),
      condition: dim('a.condition', 'reports.fields.condition', { translate: 'condition' }),
      campus: dim('cm.name', 'reports.fields.campus', { needs: ['campus'] }),
      faculty: dim('f.name', 'reports.fields.faculty', { needs: ['faculty'] }),
      department: dim('d.name', 'reports.fields.department', { needs: ['department'] }),
      building: dim('b.name', 'reports.fields.building', { needs: ['building'] }),
      room: dim('rm.name', 'reports.fields.room', { needs: ['room'] }),
      supplier: dim('s.name', 'reports.fields.supplier', { needs: ['supplier'] }),
      brand: dim('a.brand', 'reports.fields.brand'),
      model: dim('a.model', 'reports.fields.model'),
      asset: dim('a.name', 'reports.fields.asset'),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.assetCount', 'integer'),
      purchase_value: money('SUM(COALESCE(a.purchase_price, 0))', 'reports.metrics.purchaseValue'),
      current_value: money('SUM(COALESCE(a.current_value, 0))', 'reports.metrics.currentValue'),
      depreciated_value: money('SUM(COALESCE(a.purchase_price, 0) - COALESCE(a.current_value, 0))', 'reports.metrics.depreciatedValue'),
      avg_price: money('AVG(COALESCE(a.purchase_price, 0))', 'reports.metrics.averagePrice'),
      max_price: money('MAX(COALESCE(a.purchase_price, 0))', 'reports.metrics.highestPrice'),
    },
    fields: {
      asset_code: fld('a.asset_code', 'reports.fields.assetCode'),
      name: fld('a.name', 'reports.fields.asset'),
      category: fld('c.name', 'reports.fields.category', 'text', { needs: ['category'] }),
      brand: fld('a.brand', 'reports.fields.brand'),
      model: fld('a.model', 'reports.fields.model'),
      serial_number: fld('a.serial_number', 'reports.fields.serialNumber'),
      status: fld('a.status', 'reports.fields.status', 'text', { translate: 'status' }),
      condition: fld('a.condition', 'reports.fields.condition', 'text', { translate: 'condition' }),
      purchase_date: fld('a.purchase_date', 'reports.fields.purchaseDate', 'date'),
      purchase_price: fld('a.purchase_price', 'reports.fields.purchasePrice', 'currency', { financial: true }),
      current_value: fld('a.current_value', 'reports.fields.currentValue', 'currency', { financial: true }),
      warranty_expiry_date: fld('a.warranty_expiry_date', 'reports.fields.warrantyExpiry', 'date'),
      supplier: fld('s.name', 'reports.fields.supplier', 'text', { needs: ['supplier'] }),
      campus: fld('cm.name', 'reports.fields.campus', 'text', { needs: ['campus'] }),
      department: fld('d.name', 'reports.fields.department', 'text', { needs: ['department'] }),
      room: fld('rm.name', 'reports.fields.room', 'text', { needs: ['room'] }),
      employee: fld("TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))", 'reports.fields.employee', 'text', { needs: ['employee'] }),
    },
    filters: {
      status: flt('a.status', 'reports.fields.status', 'enum', { options: ASSET_STATUSES, translate: 'status' }),
      condition: flt('a.condition', 'reports.fields.condition', 'enum', { options: CONDITIONS, translate: 'condition' }),
      category: flt('c.name', 'reports.fields.category', 'text', { needs: ['category'], lookup: 'categories' }),
      campus: flt('cm.name', 'reports.fields.campus', 'text', { needs: ['campus'], lookup: 'campuses' }),
      department: flt('d.name', 'reports.fields.department', 'text', { needs: ['department'], lookup: 'departments' }),
      supplier: flt('s.name', 'reports.fields.supplier', 'text', { needs: ['supplier'], lookup: 'suppliers' }),
      brand: flt('a.brand', 'reports.fields.brand', 'text'),
      asset: flt('a.name', 'reports.fields.asset', 'text'),
      purchase_price: flt('a.purchase_price', 'reports.fields.purchasePrice', 'number', { financial: true }),
      current_value: flt('a.current_value', 'reports.fields.currentValue', 'number', { financial: true }),
      purchase_date: flt('a.purchase_date', 'reports.fields.purchaseDate', 'date'),
      warranty_expiry_date: flt('a.warranty_expiry_date', 'reports.fields.warrantyExpiry', 'date'),
    },
    joins: j,
    defaults: {
      metrics: ['count'],
      dimensions: ['category'],
      fields: ['asset_code', 'name', 'category', 'status', 'purchase_date', 'purchase_price'],
      chart: 'bar',
    },
  },

  // --------------------------------------------------------- assignments ---
  assignments: {
    id: 'assignments',
    labelKey: 'reports.modules.assignments',
    descriptionKey: 'reports.modules.assignmentsDesc',
    icon: 'assignment_ind',
    accent: 'teal',
    permission: 'assets.view',
    from: 'asset_assignments aa',
    baseWhere: [],
    joins: {
      asset: 'LEFT JOIN assets a ON a.id = aa.asset_id',
      category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
      employee: 'LEFT JOIN employees e ON e.id = aa.employee_id',
      department: 'LEFT JOIN departments d ON d.id = e.department_id',
      assigner: 'LEFT JOIN users u ON u.id = aa.assigned_by',
    },
    scope: { department: 'e.department_id', needs: ['employee'] },
    dates: {
      assigned_date: { expr: 'aa.assigned_date', labelKey: 'reports.fields.assignedDate' },
      expected_return_date: { expr: 'aa.expected_return_date', labelKey: 'reports.fields.expectedReturn' },
      returned_date: { expr: 'aa.returned_date', labelKey: 'reports.fields.returnedDate' },
    },
    defaultDate: 'assigned_date',
    dimensions: {
      status: dim('aa.status', 'reports.fields.status', { translate: 'status' }),
      employee: dim("TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))", 'reports.fields.employee', { needs: ['employee'] }),
      department: dim('d.name', 'reports.fields.department', { needs: ['employee', 'department'] }),
      category: dim('c.name', 'reports.fields.category', { needs: ['asset', 'category'] }),
      asset: dim('a.name', 'reports.fields.asset', { needs: ['asset'] }),
      assigned_by: dim('u.name', 'reports.fields.assignedBy', { needs: ['assigner'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.assignmentCount', 'integer'),
      active: met("SUM(CASE WHEN aa.status = 'active' THEN 1 ELSE 0 END)", 'reports.metrics.activeAssignments', 'integer'),
      returned: met("SUM(CASE WHEN aa.returned_date IS NOT NULL THEN 1 ELSE 0 END)", 'reports.metrics.returned', 'integer'),
      overdue: met("SUM(CASE WHEN aa.returned_date IS NULL AND aa.expected_return_date IS NOT NULL AND date(aa.expected_return_date) < date('now') THEN 1 ELSE 0 END)", 'reports.metrics.overdue', 'integer'),
      distinct_employees: met('COUNT(DISTINCT aa.employee_id)', 'reports.metrics.employeeCount', 'integer'),
    },
    fields: {
      asset_code: fld('a.asset_code', 'reports.fields.assetCode', 'text', { needs: ['asset'] }),
      asset: fld('a.name', 'reports.fields.asset', 'text', { needs: ['asset'] }),
      employee: fld("TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))", 'reports.fields.employee', 'text', { needs: ['employee'] }),
      department: fld('d.name', 'reports.fields.department', 'text', { needs: ['employee', 'department'] }),
      assigned_date: fld('aa.assigned_date', 'reports.fields.assignedDate', 'date'),
      expected_return_date: fld('aa.expected_return_date', 'reports.fields.expectedReturn', 'date'),
      returned_date: fld('aa.returned_date', 'reports.fields.returnedDate', 'date'),
      status: fld('aa.status', 'reports.fields.status', 'text', { translate: 'status' }),
      notes: fld('aa.notes', 'reports.fields.notes'),
    },
    filters: {
      status: flt('aa.status', 'reports.fields.status', 'enum', { options: ['active', 'returned', 'overdue', 'cancelled'], translate: 'status' }),
      employee: flt("TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))", 'reports.fields.employee', 'text', { needs: ['employee'] }),
      department: flt('d.name', 'reports.fields.department', 'text', { needs: ['employee', 'department'], lookup: 'departments' }),
      category: flt('c.name', 'reports.fields.category', 'text', { needs: ['asset', 'category'], lookup: 'categories' }),
      assigned_date: flt('aa.assigned_date', 'reports.fields.assignedDate', 'date'),
      expected_return_date: flt('aa.expected_return_date', 'reports.fields.expectedReturn', 'date'),
    },
    defaults: { metrics: ['count'], dimensions: ['status'], fields: ['asset_code', 'asset', 'employee', 'assigned_date', 'status'], chart: 'donut' },
  },

  // --------------------------------------------------------- maintenance ---
  maintenance: {
    id: 'maintenance',
    labelKey: 'reports.modules.maintenance',
    descriptionKey: 'reports.modules.maintenanceDesc',
    icon: 'build',
    accent: 'amber',
    permission: 'maintenance.view',
    from: 'asset_maintenances m',
    baseWhere: [],
    joins: {
      asset: 'LEFT JOIN assets a ON a.id = m.asset_id',
      category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
      department: 'LEFT JOIN departments d ON d.id = a.department_id',
      campus: 'LEFT JOIN campuses cm ON cm.id = a.campus_id',
      technician: 'LEFT JOIN users u ON u.id = m.technician_id',
    },
    scope: { department: 'a.department_id', needs: ['asset'] },
    dates: {
      start_date: { expr: 'm.start_date', labelKey: 'reports.fields.startDate' },
      end_date: { expr: 'm.end_date', labelKey: 'reports.fields.endDate' },
      scheduled_date: { expr: 'm.scheduled_date', labelKey: 'reports.fields.scheduledDate' },
      created_at: { expr: 'm.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'created_at',
    dimensions: {
      type: dim('m.maintenance_type', 'reports.fields.maintenanceType', { translate: 'maintenanceType' }),
      status: dim('m.status', 'reports.fields.status', { translate: 'status' }),
      category: dim('c.name', 'reports.fields.category', { needs: ['asset', 'category'] }),
      asset: dim('a.name', 'reports.fields.asset', { needs: ['asset'] }),
      technician: dim('u.name', 'reports.fields.technician', { needs: ['technician'] }),
      department: dim('d.name', 'reports.fields.department', { needs: ['asset', 'department'] }),
      campus: dim('cm.name', 'reports.fields.campus', { needs: ['asset', 'campus'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.workOrders', 'integer'),
      total_cost: money('SUM(COALESCE(m.cost, 0))', 'reports.metrics.totalCost'),
      avg_cost: money('AVG(COALESCE(m.cost, 0))', 'reports.metrics.averageCost'),
      max_cost: money('MAX(COALESCE(m.cost, 0))', 'reports.metrics.highestCost'),
      completed: met("SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END)", 'reports.metrics.completed', 'integer'),
      open: met("SUM(CASE WHEN m.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END)", 'reports.metrics.open', 'integer'),
      distinct_assets: met('COUNT(DISTINCT m.asset_id)', 'reports.metrics.assetCount', 'integer'),
    },
    fields: {
      asset_code: fld('a.asset_code', 'reports.fields.assetCode', 'text', { needs: ['asset'] }),
      asset: fld('a.name', 'reports.fields.asset', 'text', { needs: ['asset'] }),
      type: fld('m.maintenance_type', 'reports.fields.maintenanceType', 'text', { translate: 'maintenanceType' }),
      status: fld('m.status', 'reports.fields.status', 'text', { translate: 'status' }),
      technician: fld('u.name', 'reports.fields.technician', 'text', { needs: ['technician'] }),
      scheduled_date: fld('m.scheduled_date', 'reports.fields.scheduledDate', 'date'),
      start_date: fld('m.start_date', 'reports.fields.startDate', 'date'),
      end_date: fld('m.end_date', 'reports.fields.endDate', 'date'),
      cost: fld('m.cost', 'reports.fields.cost', 'currency', { financial: true }),
      result: fld('m.result', 'reports.fields.result'),
    },
    filters: {
      status: flt('m.status', 'reports.fields.status', 'enum', { options: ['requested', 'approved', 'in_progress', 'completed', 'cancelled'], translate: 'status' }),
      type: flt('m.maintenance_type', 'reports.fields.maintenanceType', 'enum', { options: ['preventive', 'corrective', 'emergency', 'inspection'], translate: 'maintenanceType' }),
      category: flt('c.name', 'reports.fields.category', 'text', { needs: ['asset', 'category'], lookup: 'categories' }),
      technician: flt('u.name', 'reports.fields.technician', 'text', { needs: ['technician'] }),
      cost: flt('m.cost', 'reports.fields.cost', 'number', { financial: true }),
      start_date: flt('m.start_date', 'reports.fields.startDate', 'date'),
      created_at: flt('m.created_at', 'reports.fields.createdAt', 'date'),
    },
    defaults: { metrics: ['count', 'total_cost'], dimensions: ['type'], fields: ['asset_code', 'asset', 'type', 'status', 'start_date', 'cost'], chart: 'bar' },
  },

  // --------------------------------------------------------- procurement ---
  procurement: {
    id: 'procurement',
    labelKey: 'reports.modules.procurement',
    descriptionKey: 'reports.modules.procurementDesc',
    icon: 'shopping_cart',
    accent: 'violet',
    permission: 'procurement.view',
    from: 'purchase_orders po',
    baseWhere: [],
    joins: {
      supplier: 'LEFT JOIN suppliers s ON s.id = po.supplier_id',
      creator: 'LEFT JOIN users u ON u.id = po.created_by',
      request: 'LEFT JOIN purchase_requests pr ON pr.id = po.purchase_request_id',
      department: 'LEFT JOIN departments d ON d.id = pr.department_id',
    },
    scope: { department: 'pr.department_id', needs: ['request'] },
    dates: {
      order_date: { expr: 'po.order_date', labelKey: 'reports.fields.orderDate' },
      expected_date: { expr: 'po.expected_date', labelKey: 'reports.fields.expectedDate' },
      created_at: { expr: 'po.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'order_date',
    dimensions: {
      supplier: dim('s.name', 'reports.fields.supplier', { needs: ['supplier'] }),
      status: dim('po.status', 'reports.fields.status', { translate: 'status' }),
      created_by: dim('u.name', 'reports.fields.createdBy', { needs: ['creator'] }),
      department: dim('d.name', 'reports.fields.department', { needs: ['request', 'department'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.orderCount', 'integer'),
      total_amount: money('SUM(COALESCE(po.total, 0))', 'reports.metrics.totalAmount'),
      subtotal: money('SUM(COALESCE(po.subtotal, 0))', 'reports.metrics.subtotal'),
      tax: money('SUM(COALESCE(po.tax, 0))', 'reports.metrics.tax'),
      avg_amount: money('AVG(COALESCE(po.total, 0))', 'reports.metrics.averageOrder'),
      max_amount: money('MAX(COALESCE(po.total, 0))', 'reports.metrics.largestOrder'),
      distinct_suppliers: met('COUNT(DISTINCT po.supplier_id)', 'reports.metrics.supplierCount', 'integer'),
    },
    fields: {
      po_number: fld('po.po_number', 'reports.fields.poNumber'),
      supplier: fld('s.name', 'reports.fields.supplier', 'text', { needs: ['supplier'] }),
      status: fld('po.status', 'reports.fields.status', 'text', { translate: 'status' }),
      order_date: fld('po.order_date', 'reports.fields.orderDate', 'date'),
      expected_date: fld('po.expected_date', 'reports.fields.expectedDate', 'date'),
      subtotal: fld('po.subtotal', 'reports.fields.subtotal', 'currency', { financial: true }),
      tax: fld('po.tax', 'reports.fields.tax', 'currency', { financial: true }),
      total: fld('po.total', 'reports.fields.total', 'currency', { financial: true }),
      created_by: fld('u.name', 'reports.fields.createdBy', 'text', { needs: ['creator'] }),
    },
    filters: {
      status: flt('po.status', 'reports.fields.status', 'enum', { options: ['draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'], translate: 'status' }),
      supplier: flt('s.name', 'reports.fields.supplier', 'text', { needs: ['supplier'], lookup: 'suppliers' }),
      total: flt('po.total', 'reports.fields.total', 'number', { financial: true }),
      order_date: flt('po.order_date', 'reports.fields.orderDate', 'date'),
    },
    defaults: { metrics: ['count', 'total_amount'], dimensions: ['supplier'], fields: ['po_number', 'supplier', 'status', 'order_date', 'total'], chart: 'bar' },
  },

  // ------------------------------------------------------ purchase items ---
  purchase_items: {
    id: 'purchase_items',
    labelKey: 'reports.modules.purchaseItems',
    descriptionKey: 'reports.modules.purchaseItemsDesc',
    icon: 'list_alt',
    accent: 'purple',
    permission: 'procurement.view',
    from: 'purchase_order_items poi',
    baseWhere: [],
    joins: {
      order: 'LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id',
      supplier: 'LEFT JOIN suppliers s ON s.id = po.supplier_id',
      category: 'LEFT JOIN asset_categories c ON c.id = poi.asset_category_id',
    },
    dates: {
      order_date: { expr: 'po.order_date', labelKey: 'reports.fields.orderDate', needs: ['order'] },
      created_at: { expr: 'poi.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'order_date',
    dimensions: {
      item: dim('poi.name', 'reports.fields.item'),
      category: dim('c.name', 'reports.fields.category', { needs: ['category'] }),
      brand: dim('poi.brand', 'reports.fields.brand'),
      supplier: dim('s.name', 'reports.fields.supplier', { needs: ['order', 'supplier'] }),
      status: dim('po.status', 'reports.fields.status', { needs: ['order'], translate: 'status' }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.lineCount', 'integer'),
      quantity: met('SUM(COALESCE(poi.quantity, 0))', 'reports.metrics.quantity', 'integer'),
      received_quantity: met('SUM(COALESCE(poi.received_quantity, 0))', 'reports.metrics.receivedQuantity', 'integer'),
      pending_quantity: met('SUM(COALESCE(poi.quantity, 0) - COALESCE(poi.received_quantity, 0))', 'reports.metrics.pendingQuantity', 'integer'),
      total_amount: money('SUM(COALESCE(poi.quantity, 0) * COALESCE(poi.unit_price, 0))', 'reports.metrics.totalAmount'),
      avg_unit_price: money('AVG(COALESCE(poi.unit_price, 0))', 'reports.metrics.averageUnitPrice'),
    },
    fields: {
      item: fld('poi.name', 'reports.fields.item'),
      category: fld('c.name', 'reports.fields.category', 'text', { needs: ['category'] }),
      brand: fld('poi.brand', 'reports.fields.brand'),
      model: fld('poi.model', 'reports.fields.model'),
      quantity: fld('poi.quantity', 'reports.fields.quantity', 'integer'),
      received_quantity: fld('poi.received_quantity', 'reports.fields.receivedQuantity', 'integer'),
      unit_price: fld('poi.unit_price', 'reports.fields.unitPrice', 'currency', { financial: true }),
      po_number: fld('po.po_number', 'reports.fields.poNumber', 'text', { needs: ['order'] }),
      supplier: fld('s.name', 'reports.fields.supplier', 'text', { needs: ['order', 'supplier'] }),
      order_date: fld('po.order_date', 'reports.fields.orderDate', 'date', { needs: ['order'] }),
    },
    filters: {
      item: flt('poi.name', 'reports.fields.item', 'text'),
      category: flt('c.name', 'reports.fields.category', 'text', { needs: ['category'], lookup: 'categories' }),
      supplier: flt('s.name', 'reports.fields.supplier', 'text', { needs: ['order', 'supplier'], lookup: 'suppliers' }),
      quantity: flt('poi.quantity', 'reports.fields.quantity', 'number'),
      unit_price: flt('poi.unit_price', 'reports.fields.unitPrice', 'number', { financial: true }),
      order_date: flt('po.order_date', 'reports.fields.orderDate', 'date', { needs: ['order'] }),
    },
    defaults: { metrics: ['quantity', 'total_amount'], dimensions: ['item'], fields: ['item', 'category', 'quantity', 'unit_price', 'supplier'], chart: 'bar' },
  },

  // ----------------------------------------------------------- warehouse ---
  warehouse: {
    id: 'warehouse',
    labelKey: 'reports.modules.warehouse',
    descriptionKey: 'reports.modules.warehouseDesc',
    icon: 'warehouse',
    accent: 'cyan',
    permission: 'warehouse.view',
    from: 'warehouse_transactions wt',
    baseWhere: [],
    joins: {
      warehouse: 'LEFT JOIN warehouses w ON w.id = wt.warehouse_id',
      asset: 'LEFT JOIN assets a ON a.id = wt.asset_id',
      category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
      user: 'LEFT JOIN users u ON u.id = wt.user_id',
    },
    dates: { created_at: { expr: 'wt.created_at', labelKey: 'reports.fields.transactionDate' } },
    defaultDate: 'created_at',
    dimensions: {
      warehouse: dim('w.name', 'reports.fields.warehouse', { needs: ['warehouse'] }),
      type: dim('wt.type', 'reports.fields.transactionType', { translate: 'transactionType' }),
      category: dim('c.name', 'reports.fields.category', { needs: ['asset', 'category'] }),
      asset: dim('a.name', 'reports.fields.asset', { needs: ['asset'] }),
      user: dim('u.name', 'reports.fields.user', { needs: ['user'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.transactionCount', 'integer'),
      quantity: met('SUM(COALESCE(wt.quantity, 0))', 'reports.metrics.quantity', 'integer'),
      inbound: met("SUM(CASE WHEN wt.type IN ('in', 'receipt', 'return') THEN COALESCE(wt.quantity, 0) ELSE 0 END)", 'reports.metrics.inbound', 'integer'),
      outbound: met("SUM(CASE WHEN wt.type IN ('out', 'issue', 'transfer') THEN COALESCE(wt.quantity, 0) ELSE 0 END)", 'reports.metrics.outbound', 'integer'),
      distinct_assets: met('COUNT(DISTINCT wt.asset_id)', 'reports.metrics.assetCount', 'integer'),
    },
    fields: {
      warehouse: fld('w.name', 'reports.fields.warehouse', 'text', { needs: ['warehouse'] }),
      asset_code: fld('a.asset_code', 'reports.fields.assetCode', 'text', { needs: ['asset'] }),
      asset: fld('a.name', 'reports.fields.asset', 'text', { needs: ['asset'] }),
      type: fld('wt.type', 'reports.fields.transactionType', 'text', { translate: 'transactionType' }),
      quantity: fld('wt.quantity', 'reports.fields.quantity', 'integer'),
      created_at: fld('wt.created_at', 'reports.fields.transactionDate', 'date'),
      user: fld('u.name', 'reports.fields.user', 'text', { needs: ['user'] }),
      notes: fld('wt.notes', 'reports.fields.notes'),
    },
    filters: {
      warehouse: flt('w.name', 'reports.fields.warehouse', 'text', { needs: ['warehouse'], lookup: 'warehouses' }),
      type: flt('wt.type', 'reports.fields.transactionType', 'enum', { options: ['in', 'out', 'transfer', 'adjustment', 'receipt', 'issue', 'return'], translate: 'transactionType' }),
      category: flt('c.name', 'reports.fields.category', 'text', { needs: ['asset', 'category'], lookup: 'categories' }),
      created_at: flt('wt.created_at', 'reports.fields.transactionDate', 'date'),
    },
    defaults: { metrics: ['count', 'quantity'], dimensions: ['warehouse'], fields: ['warehouse', 'asset_code', 'type', 'quantity', 'created_at'], chart: 'bar' },
  },

  // -------------------------------------------------------- depreciation ---
  depreciation: {
    id: 'depreciation',
    labelKey: 'reports.modules.depreciation',
    descriptionKey: 'reports.modules.depreciationDesc',
    icon: 'trending_down',
    accent: 'indigo',
    permission: 'depreciation.view',
    from: 'asset_depreciations dp',
    baseWhere: [],
    joins: {
      asset: 'LEFT JOIN assets a ON a.id = dp.asset_id',
      category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
      method: 'LEFT JOIN depreciation_methods dm ON dm.id = dp.method_id',
      department: 'LEFT JOIN departments d ON d.id = a.department_id',
    },
    scope: { department: 'a.department_id', needs: ['asset'] },
    dates: { created_at: { expr: 'dp.created_at', labelKey: 'reports.fields.createdAt' } },
    defaultDate: 'created_at',
    dimensions: {
      period: dim('dp.period', 'reports.fields.period'),
      category: dim('c.name', 'reports.fields.category', { needs: ['asset', 'category'] }),
      method: dim('dm.name', 'reports.fields.method', { needs: ['method'] }),
      asset: dim('a.name', 'reports.fields.asset', { needs: ['asset'] }),
      department: dim('d.name', 'reports.fields.department', { needs: ['asset', 'department'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.records', 'integer'),
      original_value: money('SUM(COALESCE(dp.original_value, 0))', 'reports.metrics.originalValue'),
      annual_depreciation: money('SUM(COALESCE(dp.annual_depreciation, 0))', 'reports.metrics.annualDepreciation'),
      accumulated_depreciation: money('SUM(COALESCE(dp.accumulated_depreciation, 0))', 'reports.metrics.accumulatedDepreciation'),
      book_value: money('SUM(COALESCE(dp.book_value, 0))', 'reports.metrics.bookValue'),
    },
    fields: {
      asset_code: fld('a.asset_code', 'reports.fields.assetCode', 'text', { needs: ['asset'] }),
      asset: fld('a.name', 'reports.fields.asset', 'text', { needs: ['asset'] }),
      period: fld('dp.period', 'reports.fields.period'),
      method: fld('dm.name', 'reports.fields.method', 'text', { needs: ['method'] }),
      original_value: fld('dp.original_value', 'reports.fields.originalValue', 'currency', { financial: true }),
      accumulated_depreciation: fld('dp.accumulated_depreciation', 'reports.fields.accumulatedDepreciation', 'currency', { financial: true }),
      book_value: fld('dp.book_value', 'reports.fields.bookValue', 'currency', { financial: true }),
    },
    filters: {
      period: flt('dp.period', 'reports.fields.period', 'text'),
      category: flt('c.name', 'reports.fields.category', 'text', { needs: ['asset', 'category'], lookup: 'categories' }),
      book_value: flt('dp.book_value', 'reports.fields.bookValue', 'number', { financial: true }),
    },
    defaults: { metrics: ['book_value', 'accumulated_depreciation'], dimensions: ['period'], fields: ['asset_code', 'asset', 'period', 'original_value', 'book_value'], chart: 'line' },
  },

  // ------------------------------------------------------------ disposals ---
  disposals: {
    id: 'disposals',
    labelKey: 'reports.modules.disposals',
    descriptionKey: 'reports.modules.disposalsDesc',
    icon: 'delete_sweep',
    accent: 'rose',
    permission: 'assets.view',
    from: 'asset_disposals ad',
    baseWhere: [],
    joins: {
      asset: 'LEFT JOIN assets a ON a.id = ad.asset_id',
      category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
      approver: 'LEFT JOIN users u ON u.id = ad.approved_by',
    },
    scope: { department: 'a.department_id', needs: ['asset'] },
    dates: {
      disposal_date: { expr: 'ad.disposal_date', labelKey: 'reports.fields.disposalDate' },
      request_date: { expr: 'ad.request_date', labelKey: 'reports.fields.requestDate' },
      created_at: { expr: 'ad.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'disposal_date',
    dimensions: {
      method: dim('ad.method', 'reports.fields.disposalMethod', { translate: 'disposalMethod' }),
      status: dim('ad.status', 'reports.fields.status', { translate: 'status' }),
      category: dim('c.name', 'reports.fields.category', { needs: ['asset', 'category'] }),
      approved_by: dim('u.name', 'reports.fields.approvedBy', { needs: ['approver'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.disposalCount', 'integer'),
      revenue: money('SUM(COALESCE(ad.revenue, 0))', 'reports.metrics.revenue'),
      avg_revenue: money('AVG(COALESCE(ad.revenue, 0))', 'reports.metrics.averageRevenue'),
    },
    fields: {
      asset_code: fld('a.asset_code', 'reports.fields.assetCode', 'text', { needs: ['asset'] }),
      asset: fld('a.name', 'reports.fields.asset', 'text', { needs: ['asset'] }),
      method: fld('ad.method', 'reports.fields.disposalMethod', 'text', { translate: 'disposalMethod' }),
      status: fld('ad.status', 'reports.fields.status', 'text', { translate: 'status' }),
      request_date: fld('ad.request_date', 'reports.fields.requestDate', 'date'),
      disposal_date: fld('ad.disposal_date', 'reports.fields.disposalDate', 'date'),
      revenue: fld('ad.revenue', 'reports.fields.revenue', 'currency', { financial: true }),
    },
    filters: {
      status: flt('ad.status', 'reports.fields.status', 'enum', { options: ['draft', 'pending', 'approved', 'rejected', 'completed'], translate: 'status' }),
      method: flt('ad.method', 'reports.fields.disposalMethod', 'enum', { options: ['sold', 'scrapped', 'donated', 'recycled', 'lost'], translate: 'disposalMethod' }),
      disposal_date: flt('ad.disposal_date', 'reports.fields.disposalDate', 'date'),
      revenue: flt('ad.revenue', 'reports.fields.revenue', 'number', { financial: true }),
    },
    defaults: { metrics: ['count', 'revenue'], dimensions: ['method'], fields: ['asset_code', 'asset', 'method', 'status', 'disposal_date', 'revenue'], chart: 'donut' },
  },

  // ------------------------------------------------------------ incidents ---
  incidents: {
    id: 'incidents',
    labelKey: 'reports.modules.incidents',
    descriptionKey: 'reports.modules.incidentsDesc',
    icon: 'report_problem',
    accent: 'orange',
    permission: 'incidents.view',
    from: 'asset_incidents ai',
    baseWhere: [],
    joins: {
      asset: 'LEFT JOIN assets a ON a.id = ai.asset_id',
      category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
      reporter: 'LEFT JOIN users u ON u.id = ai.reported_by',
      department: 'LEFT JOIN departments d ON d.id = a.department_id',
    },
    scope: { department: 'a.department_id', needs: ['asset'] },
    dates: {
      incident_date: { expr: 'ai.incident_date', labelKey: 'reports.fields.incidentDate' },
      created_at: { expr: 'ai.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'incident_date',
    dimensions: {
      type: dim('ai.incident_type', 'reports.fields.incidentType', { translate: 'incidentType' }),
      status: dim('ai.status', 'reports.fields.status', { translate: 'status' }),
      category: dim('c.name', 'reports.fields.category', { needs: ['asset', 'category'] }),
      department: dim('d.name', 'reports.fields.department', { needs: ['asset', 'department'] }),
      reported_by: dim('u.name', 'reports.fields.reportedBy', { needs: ['reporter'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.incidentCount', 'integer'),
      open: met("SUM(CASE WHEN ai.status = 'open' THEN 1 ELSE 0 END)", 'reports.metrics.open', 'integer'),
      resolved: met("SUM(CASE WHEN ai.status IN ('resolved', 'closed') THEN 1 ELSE 0 END)", 'reports.metrics.resolved', 'integer'),
      distinct_assets: met('COUNT(DISTINCT ai.asset_id)', 'reports.metrics.assetCount', 'integer'),
    },
    fields: {
      asset_code: fld('a.asset_code', 'reports.fields.assetCode', 'text', { needs: ['asset'] }),
      asset: fld('a.name', 'reports.fields.asset', 'text', { needs: ['asset'] }),
      type: fld('ai.incident_type', 'reports.fields.incidentType', 'text', { translate: 'incidentType' }),
      status: fld('ai.status', 'reports.fields.status', 'text', { translate: 'status' }),
      incident_date: fld('ai.incident_date', 'reports.fields.incidentDate', 'date'),
      description: fld('ai.description', 'reports.fields.description'),
      reported_by: fld('u.name', 'reports.fields.reportedBy', 'text', { needs: ['reporter'] }),
    },
    filters: {
      status: flt('ai.status', 'reports.fields.status', 'enum', { options: ['open', 'investigating', 'resolved', 'closed'], translate: 'status' }),
      type: flt('ai.incident_type', 'reports.fields.incidentType', 'enum', { options: ['damage', 'loss', 'theft', 'malfunction', 'other'], translate: 'incidentType' }),
      incident_date: flt('ai.incident_date', 'reports.fields.incidentDate', 'date'),
    },
    defaults: { metrics: ['count'], dimensions: ['type'], fields: ['asset_code', 'asset', 'type', 'status', 'incident_date'], chart: 'donut' },
  },

  // ------------------------------------------------------------ employees ---
  employees: {
    id: 'employees',
    labelKey: 'reports.modules.employees',
    descriptionKey: 'reports.modules.employeesDesc',
    icon: 'groups',
    accent: 'green',
    permission: 'employees.view',
    from: 'employees e',
    baseWhere: ['e.deleted_at IS NULL'],
    joins: {
      department: 'LEFT JOIN departments d ON d.id = e.department_id',
      faculty: 'LEFT JOIN faculties f ON f.id = d.faculty_id',
    },
    scope: { department: 'e.department_id' },
    dates: {
      hire_date: { expr: 'e.hire_date', labelKey: 'reports.fields.hireDate' },
      created_at: { expr: 'e.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'hire_date',
    dimensions: {
      department: dim('d.name', 'reports.fields.department', { needs: ['department'] }),
      faculty: dim('f.name', 'reports.fields.faculty', { needs: ['department', 'faculty'] }),
      status: dim('e.status', 'reports.fields.status', { translate: 'status' }),
      employment_type: dim('e.employment_type', 'reports.fields.employmentType', { translate: 'employmentType' }),
      position: dim('e.position', 'reports.fields.position'),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.employeeCount', 'integer'),
      active: met("SUM(CASE WHEN e.status = 'active' THEN 1 ELSE 0 END)", 'reports.metrics.active', 'integer'),
    },
    fields: {
      employee_code: fld('e.employee_code', 'reports.fields.employeeCode'),
      name: fld("TRIM(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, ''))", 'reports.fields.employee'),
      department: fld('d.name', 'reports.fields.department', 'text', { needs: ['department'] }),
      position: fld('e.position', 'reports.fields.position'),
      employment_type: fld('e.employment_type', 'reports.fields.employmentType', 'text', { translate: 'employmentType' }),
      status: fld('e.status', 'reports.fields.status', 'text', { translate: 'status' }),
      hire_date: fld('e.hire_date', 'reports.fields.hireDate', 'date'),
      email: fld('e.email', 'reports.fields.email'),
      phone: fld('e.phone', 'reports.fields.phone'),
    },
    filters: {
      status: flt('e.status', 'reports.fields.status', 'enum', { options: ['active', 'inactive', 'on_leave', 'terminated'], translate: 'status' }),
      department: flt('d.name', 'reports.fields.department', 'text', { needs: ['department'], lookup: 'departments' }),
      employment_type: flt('e.employment_type', 'reports.fields.employmentType', 'enum', { options: ['full_time', 'part_time', 'contract', 'temporary'], translate: 'employmentType' }),
      hire_date: flt('e.hire_date', 'reports.fields.hireDate', 'date'),
    },
    defaults: { metrics: ['count'], dimensions: ['department'], fields: ['employee_code', 'name', 'department', 'position', 'status'], chart: 'bar' },
  },

  // ------------------------------------------------------------ transfers ---
  transfers: {
    id: 'transfers',
    labelKey: 'reports.modules.transfers',
    descriptionKey: 'reports.modules.transfersDesc',
    icon: 'swap_horiz',
    accent: 'slate',
    permission: 'assets.view',
    from: 'asset_transfers tr',
    baseWhere: [],
    joins: {
      asset: 'LEFT JOIN assets a ON a.id = tr.asset_id',
      category: 'LEFT JOIN asset_categories c ON c.id = a.category_id',
      fromDept: 'LEFT JOIN departments dfrom ON dfrom.id = tr.from_department_id',
      toDept: 'LEFT JOIN departments dto ON dto.id = tr.to_department_id',
    },
    dates: {
      transfer_date: { expr: 'tr.transfer_date', labelKey: 'reports.fields.transferDate' },
      created_at: { expr: 'tr.created_at', labelKey: 'reports.fields.createdAt' },
    },
    defaultDate: 'transfer_date',
    dimensions: {
      status: dim('tr.status', 'reports.fields.status', { translate: 'status' }),
      from_department: dim('dfrom.name', 'reports.fields.fromDepartment', { needs: ['fromDept'] }),
      to_department: dim('dto.name', 'reports.fields.toDepartment', { needs: ['toDept'] }),
      category: dim('c.name', 'reports.fields.category', { needs: ['asset', 'category'] }),
    },
    metrics: {
      count: met('COUNT(*)', 'reports.metrics.transferCount', 'integer'),
      completed: met("SUM(CASE WHEN tr.status = 'completed' THEN 1 ELSE 0 END)", 'reports.metrics.completed', 'integer'),
      distinct_assets: met('COUNT(DISTINCT tr.asset_id)', 'reports.metrics.assetCount', 'integer'),
    },
    fields: {
      asset_code: fld('a.asset_code', 'reports.fields.assetCode', 'text', { needs: ['asset'] }),
      asset: fld('a.name', 'reports.fields.asset', 'text', { needs: ['asset'] }),
      from_department: fld('dfrom.name', 'reports.fields.fromDepartment', 'text', { needs: ['fromDept'] }),
      to_department: fld('dto.name', 'reports.fields.toDepartment', 'text', { needs: ['toDept'] }),
      transfer_date: fld('tr.transfer_date', 'reports.fields.transferDate', 'date'),
      status: fld('tr.status', 'reports.fields.status', 'text', { translate: 'status' }),
    },
    filters: {
      status: flt('tr.status', 'reports.fields.status', 'enum', { options: ['draft', 'pending', 'approved', 'completed', 'rejected'], translate: 'status' }),
      transfer_date: flt('tr.transfer_date', 'reports.fields.transferDate', 'date'),
    },
    defaults: { metrics: ['count'], dimensions: ['status'], fields: ['asset_code', 'asset', 'from_department', 'to_department', 'transfer_date', 'status'], chart: 'bar' },
  },
}

/** Time-bucket SQL for a dataset's active date column. */
export function timeBucketSql(bucket, dateExpr) {
  const def = TIME_BUCKETS[bucket]
  return def ? def.sql(dateExpr) : null
}

export function timeBucketLabelKey(bucket) {
  return TIME_BUCKETS[bucket]?.labelKey || 'reports.fields.period'
}

/**
 * The client-safe projection of the catalog: label keys, types and option
 * lists, but never a table name, column name or SQL fragment. Datasets and
 * metrics the caller may not read are removed entirely, so the UI cannot even
 * offer them.
 */
export function publicCatalog({ can }) {
  const modules = []

  for (const ds of Object.values(DATASETS)) {
    if (ds.permission && !can(ds.permission)) continue
    const financial = can('reports.view_financial')

    const project = (bag, extraKeys = []) =>
      Object.entries(bag || {})
        .filter(([, def]) => !def.financial || financial)
        .map(([id, def]) => ({
          id,
          labelKey: def.labelKey,
          type: def.type || def.format || 'text',
          ...(def.options ? { options: def.options } : {}),
          ...(def.translate ? { translate: def.translate } : {}),
          ...(def.lookup ? { lookup: def.lookup } : {}),
          ...(def.financial ? { financial: true } : {}),
          ...(extraKeys.includes('operators') ? { operators: OPERATORS[def.type] || OPERATORS.text } : {}),
        }))

    modules.push({
      id: ds.id,
      labelKey: ds.labelKey,
      descriptionKey: ds.descriptionKey,
      icon: ds.icon,
      accent: ds.accent,
      dimensions: [
        ...project(ds.dimensions),
        ...TIME_DIMENSIONS.map((b) => ({ id: b, labelKey: timeBucketLabelKey(b), type: 'time', time: true })),
      ],
      metrics: project(ds.metrics),
      fields: project(ds.fields),
      filters: project(ds.filters, ['operators']),
      dates: Object.entries(ds.dates || {}).map(([id, def]) => ({ id, labelKey: def.labelKey })),
      defaultDate: ds.defaultDate,
      defaults: ds.defaults,
    })
  }

  return {
    modules,
    datePresets: DATE_PRESETS,
    operators: OPERATORS,
    chartTypes: CHART_TYPES,
    limits: LIMITS,
  }
}

export default DATASETS

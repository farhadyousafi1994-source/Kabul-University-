<?php

namespace App\Domains\System\Services\Reports;

/**
 * ---------------------------------------------------------------------------
 * Report catalog — the semantic layer AND the security allowlist
 * ---------------------------------------------------------------------------
 *
 * The Advanced Report Generator never receives SQL from a client. A question
 * ("maintenance cost by category this year") or a builder form is turned into
 * a structured Report Query Object:
 *
 *     ['module' => 'maintenance', 'mode' => 'aggregate',
 *      'metrics' => ['cost'], 'dimensions' => ['category'],
 *      'filters' => ['date_range' => ['preset' => 'this_year']],
 *      'sort' => ['field' => 'cost', 'direction' => 'desc'], 'limit' => 50]
 *
 * and this catalog decides whether that object may run:
 *
 *   · `module`     must be a key of the dataset list
 *   · `metrics`    must be keys of the dataset's `metrics`
 *   · `dimensions` must be keys of the dataset's `dimensions` (or a time bucket)
 *   · `fields`     must be keys of the dataset's `fields`
 *   · `filters`    must be keys of the dataset's `filters`, with an operator
 *                  the field's type allows and, for enums, a listed value
 *   · every value is bound as a query parameter — never interpolated
 *
 * The SQL fragments below are static strings written by hand and kept on the
 * server. `publicCatalog()` strips them before the catalog reaches a browser:
 * the client only ever sees ids, types, option lists and translation keys.
 *
 * Adding a reportable module = adding one entry here plus its label keys in
 * `frontend/src/i18n/reports.extensions.js`. No controller or UI change.
 *
 * Expressions target the application's default SQLite connection (see
 * `config/database.php`) and mirror `frontend/mock-api/reports/catalog.js`
 * one-to-one, so the development server and the API behave identically.
 */
class ReportCatalog
{
    /** Operators a filter may use, per value type. */
    public const OPERATORS = [
        'text' => ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty', 'in'],
        'enum' => ['eq', 'neq', 'in', 'is_empty', 'is_not_empty'],
        'number' => ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty', 'is_not_empty'],
        'date' => ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty', 'is_not_empty'],
    ];

    /** Named, relative date ranges understood by the NLU and the builder. */
    public const DATE_PRESETS = [
        'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month',
        'this_quarter', 'this_year', 'last_year', 'last_7_days', 'last_30_days',
        'last_90_days', 'last_6_months', 'last_12_months', 'next_30_days',
        'next_90_days', 'all_time', 'custom',
    ];

    /** Chart types the client may render (validated so saved reports stay sane). */
    public const CHART_TYPES = ['auto', 'bar', 'column', 'line', 'area', 'pie', 'donut', 'table'];

    /** Hard safety limits — a report can never ask for more than this. */
    public const LIMITS = ['default' => 50, 'max' => 1000, 'detailMax' => 1000];

    /** Time buckets available on top of every dataset's active date field. */
    public const TIME_DIMENSIONS = ['day', 'week', 'month', 'quarter', 'year'];

    /** Distinct-value lists the builder may offer for a filter. */
    public const LOOKUPS = [
        'categories' => ['table' => 'asset_categories', 'column' => 'name'],
        'departments' => ['table' => 'departments', 'column' => 'name'],
        'campuses' => ['table' => 'campuses', 'column' => 'name'],
        'faculties' => ['table' => 'faculties', 'column' => 'name'],
        'suppliers' => ['table' => 'suppliers', 'column' => 'name'],
        'warehouses' => ['table' => 'warehouses', 'column' => 'name'],
        'brands' => ['table' => 'assets', 'column' => 'brand'],
    ];

    /** The SQL for a time bucket over `$dateExpr`. */
    public static function timeBucketSql(string $bucket, string $dateExpr): ?string
    {
        return match ($bucket) {
            'day' => "date({$dateExpr})",
            'week' => "strftime('%Y-W%W', {$dateExpr})",
            'month' => "strftime('%Y-%m', {$dateExpr})",
            'quarter' => "strftime('%Y', {$dateExpr}) || '-Q' || ((CAST(strftime('%m', {$dateExpr}) AS INTEGER) + 2) / 3)",
            'year' => "strftime('%Y', {$dateExpr})",
            default => null,
        };
    }

    public static function timeBucketLabelKey(string $bucket): string
    {
        return in_array($bucket, self::TIME_DIMENSIONS, true)
            ? 'reports.fields.'.$bucket
            : 'reports.fields.period';
    }

    /**
     * Every reportable dataset.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function datasets(): array
    {
        return [
        'assets' => [
            'id' => 'assets',
            'labelKey' => 'reports.modules.assets',
            'descriptionKey' => 'reports.modules.assetsDesc',
            'icon' => 'inventory_2',
            'accent' => 'blue',
            'permission' => 'assets.view',
            'from' => 'assets a',
            'baseWhere' => ['a.deleted_at IS NULL'],
            'scope' => [
                'department' => 'a.department_id',
                'campus' => 'a.campus_id',
            ],
            'dates' => [
                'purchase_date' => [
                    'expr' => 'a.purchase_date',
                    'labelKey' => 'reports.fields.purchaseDate',
                ],
                'warranty_expiry_date' => [
                    'expr' => 'a.warranty_expiry_date',
                    'labelKey' => 'reports.fields.warrantyExpiry',
                ],
                'created_at' => [
                    'expr' => 'a.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'purchase_date',
            'dimensions' => [
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['category'],
                ],
                'subcategory' => [
                    'expr' => 'sc.name',
                    'labelKey' => 'reports.fields.subcategory',
                    'needs' => ['subcategory'],
                ],
                'status' => [
                    'expr' => 'a.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'condition' => [
                    'expr' => 'a.condition',
                    'labelKey' => 'reports.fields.condition',
                    'translate' => 'condition',
                ],
                'campus' => [
                    'expr' => 'cm.name',
                    'labelKey' => 'reports.fields.campus',
                    'needs' => ['campus'],
                ],
                'faculty' => [
                    'expr' => 'f.name',
                    'labelKey' => 'reports.fields.faculty',
                    'needs' => ['faculty'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'needs' => ['department'],
                ],
                'building' => [
                    'expr' => 'b.name',
                    'labelKey' => 'reports.fields.building',
                    'needs' => ['building'],
                ],
                'room' => [
                    'expr' => 'rm.name',
                    'labelKey' => 'reports.fields.room',
                    'needs' => ['room'],
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'needs' => ['supplier'],
                ],
                'brand' => [
                    'expr' => 'a.brand',
                    'labelKey' => 'reports.fields.brand',
                ],
                'model' => [
                    'expr' => 'a.model',
                    'labelKey' => 'reports.fields.model',
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.assetCount',
                    'format' => 'integer',
                ],
                'purchase_value' => [
                    'expr' => 'SUM(COALESCE(a.purchase_price, 0))',
                    'labelKey' => 'reports.metrics.purchaseValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'current_value' => [
                    'expr' => 'SUM(COALESCE(a.current_value, 0))',
                    'labelKey' => 'reports.metrics.currentValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'depreciated_value' => [
                    'expr' => 'SUM(COALESCE(a.purchase_price, 0) - COALESCE(a.current_value, 0))',
                    'labelKey' => 'reports.metrics.depreciatedValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'avg_price' => [
                    'expr' => 'AVG(COALESCE(a.purchase_price, 0))',
                    'labelKey' => 'reports.metrics.averagePrice',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'max_price' => [
                    'expr' => 'MAX(COALESCE(a.purchase_price, 0))',
                    'labelKey' => 'reports.metrics.highestPrice',
                    'format' => 'currency',
                    'financial' => true,
                ],
            ],
            'fields' => [
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                ],
                'name' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'format' => 'text',
                    'needs' => ['category'],
                ],
                'brand' => [
                    'expr' => 'a.brand',
                    'labelKey' => 'reports.fields.brand',
                    'format' => 'text',
                ],
                'model' => [
                    'expr' => 'a.model',
                    'labelKey' => 'reports.fields.model',
                    'format' => 'text',
                ],
                'serial_number' => [
                    'expr' => 'a.serial_number',
                    'labelKey' => 'reports.fields.serialNumber',
                    'format' => 'text',
                ],
                'status' => [
                    'expr' => 'a.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
                'condition' => [
                    'expr' => 'a.condition',
                    'labelKey' => 'reports.fields.condition',
                    'format' => 'text',
                    'translate' => 'condition',
                ],
                'purchase_date' => [
                    'expr' => 'a.purchase_date',
                    'labelKey' => 'reports.fields.purchaseDate',
                    'format' => 'date',
                ],
                'purchase_price' => [
                    'expr' => 'a.purchase_price',
                    'labelKey' => 'reports.fields.purchasePrice',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'current_value' => [
                    'expr' => 'a.current_value',
                    'labelKey' => 'reports.fields.currentValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'warranty_expiry_date' => [
                    'expr' => 'a.warranty_expiry_date',
                    'labelKey' => 'reports.fields.warrantyExpiry',
                    'format' => 'date',
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'format' => 'text',
                    'needs' => ['supplier'],
                ],
                'campus' => [
                    'expr' => 'cm.name',
                    'labelKey' => 'reports.fields.campus',
                    'format' => 'text',
                    'needs' => ['campus'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'format' => 'text',
                    'needs' => ['department'],
                ],
                'room' => [
                    'expr' => 'rm.name',
                    'labelKey' => 'reports.fields.room',
                    'format' => 'text',
                    'needs' => ['room'],
                ],
                'employee' => [
                    'expr' => 'TRIM(COALESCE(e.first_name, \'\') || \' \' || COALESCE(e.last_name, \'\'))',
                    'labelKey' => 'reports.fields.employee',
                    'format' => 'text',
                    'needs' => ['employee'],
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'a.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['available', 'assigned', 'under_maintenance', 'damaged', 'lost', 'disposed', 'reserved'],
                    'translate' => 'status',
                ],
                'condition' => [
                    'expr' => 'a.condition',
                    'labelKey' => 'reports.fields.condition',
                    'type' => 'enum',
                    'options' => ['new', 'good', 'fair', 'poor', 'damaged'],
                    'translate' => 'condition',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'type' => 'text',
                    'needs' => ['category'],
                    'lookup' => 'categories',
                ],
                'campus' => [
                    'expr' => 'cm.name',
                    'labelKey' => 'reports.fields.campus',
                    'type' => 'text',
                    'needs' => ['campus'],
                    'lookup' => 'campuses',
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'type' => 'text',
                    'needs' => ['department'],
                    'lookup' => 'departments',
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'type' => 'text',
                    'needs' => ['supplier'],
                    'lookup' => 'suppliers',
                ],
                'brand' => [
                    'expr' => 'a.brand',
                    'labelKey' => 'reports.fields.brand',
                    'type' => 'text',
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'type' => 'text',
                ],
                'purchase_price' => [
                    'expr' => 'a.purchase_price',
                    'labelKey' => 'reports.fields.purchasePrice',
                    'type' => 'number',
                    'financial' => true,
                ],
                'current_value' => [
                    'expr' => 'a.current_value',
                    'labelKey' => 'reports.fields.currentValue',
                    'type' => 'number',
                    'financial' => true,
                ],
                'purchase_date' => [
                    'expr' => 'a.purchase_date',
                    'labelKey' => 'reports.fields.purchaseDate',
                    'type' => 'date',
                ],
                'warranty_expiry_date' => [
                    'expr' => 'a.warranty_expiry_date',
                    'labelKey' => 'reports.fields.warrantyExpiry',
                    'type' => 'date',
                ],
            ],
            'joins' => [
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'subcategory' => 'LEFT JOIN asset_subcategories sc ON sc.id = a.subcategory_id',
                'supplier' => 'LEFT JOIN suppliers s ON s.id = a.supplier_id',
                'campus' => 'LEFT JOIN campuses cm ON cm.id = a.campus_id',
                'faculty' => 'LEFT JOIN faculties f ON f.id = a.faculty_id',
                'department' => 'LEFT JOIN departments d ON d.id = a.department_id',
                'building' => 'LEFT JOIN buildings b ON b.id = a.building_id',
                'room' => 'LEFT JOIN rooms rm ON rm.id = a.room_id',
                'employee' => 'LEFT JOIN employees e ON e.id = a.employee_id',
            ],
            'defaults' => [
                'metrics' => ['count'],
                'dimensions' => ['category'],
                'fields' => ['asset_code', 'name', 'category', 'status', 'purchase_date', 'purchase_price'],
                'chart' => 'bar',
            ],
        ],
        'assignments' => [
            'id' => 'assignments',
            'labelKey' => 'reports.modules.assignments',
            'descriptionKey' => 'reports.modules.assignmentsDesc',
            'icon' => 'assignment_ind',
            'accent' => 'teal',
            'permission' => 'assets.view',
            'from' => 'asset_assignments aa',
            'baseWhere' => [],
            'joins' => [
                'asset' => 'LEFT JOIN assets a ON a.id = aa.asset_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'employee' => 'LEFT JOIN employees e ON e.id = aa.employee_id',
                'department' => 'LEFT JOIN departments d ON d.id = e.department_id',
                'assigner' => 'LEFT JOIN users u ON u.id = aa.assigned_by',
            ],
            'scope' => [
                'department' => 'e.department_id',
                'needs' => ['employee'],
            ],
            'dates' => [
                'assigned_date' => [
                    'expr' => 'aa.assigned_date',
                    'labelKey' => 'reports.fields.assignedDate',
                ],
                'expected_return_date' => [
                    'expr' => 'aa.expected_return_date',
                    'labelKey' => 'reports.fields.expectedReturn',
                ],
                'returned_date' => [
                    'expr' => 'aa.returned_date',
                    'labelKey' => 'reports.fields.returnedDate',
                ],
            ],
            'defaultDate' => 'assigned_date',
            'dimensions' => [
                'status' => [
                    'expr' => 'aa.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'employee' => [
                    'expr' => 'TRIM(COALESCE(e.first_name, \'\') || \' \' || COALESCE(e.last_name, \'\'))',
                    'labelKey' => 'reports.fields.employee',
                    'needs' => ['employee'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'needs' => ['employee', 'department'],
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['asset', 'category'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'needs' => ['asset'],
                ],
                'assigned_by' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.assignedBy',
                    'needs' => ['assigner'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.assignmentCount',
                    'format' => 'integer',
                ],
                'active' => [
                    'expr' => 'SUM(CASE WHEN aa.status = \'active\' THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.activeAssignments',
                    'format' => 'integer',
                ],
                'returned' => [
                    'expr' => 'SUM(CASE WHEN aa.returned_date IS NOT NULL THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.returned',
                    'format' => 'integer',
                ],
                'overdue' => [
                    'expr' => 'SUM(CASE WHEN aa.returned_date IS NULL AND aa.expected_return_date IS NOT NULL AND date(aa.expected_return_date) < date(\'now\') THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.overdue',
                    'format' => 'integer',
                ],
                'distinct_employees' => [
                    'expr' => 'COUNT(DISTINCT aa.employee_id)',
                    'labelKey' => 'reports.metrics.employeeCount',
                    'format' => 'integer',
                ],
            ],
            'fields' => [
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'employee' => [
                    'expr' => 'TRIM(COALESCE(e.first_name, \'\') || \' \' || COALESCE(e.last_name, \'\'))',
                    'labelKey' => 'reports.fields.employee',
                    'format' => 'text',
                    'needs' => ['employee'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'format' => 'text',
                    'needs' => ['employee', 'department'],
                ],
                'assigned_date' => [
                    'expr' => 'aa.assigned_date',
                    'labelKey' => 'reports.fields.assignedDate',
                    'format' => 'date',
                ],
                'expected_return_date' => [
                    'expr' => 'aa.expected_return_date',
                    'labelKey' => 'reports.fields.expectedReturn',
                    'format' => 'date',
                ],
                'returned_date' => [
                    'expr' => 'aa.returned_date',
                    'labelKey' => 'reports.fields.returnedDate',
                    'format' => 'date',
                ],
                'status' => [
                    'expr' => 'aa.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
                'notes' => [
                    'expr' => 'aa.notes',
                    'labelKey' => 'reports.fields.notes',
                    'format' => 'text',
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'aa.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['active', 'returned', 'overdue', 'cancelled'],
                    'translate' => 'status',
                ],
                'employee' => [
                    'expr' => 'TRIM(COALESCE(e.first_name, \'\') || \' \' || COALESCE(e.last_name, \'\'))',
                    'labelKey' => 'reports.fields.employee',
                    'type' => 'text',
                    'needs' => ['employee'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'type' => 'text',
                    'needs' => ['employee', 'department'],
                    'lookup' => 'departments',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'type' => 'text',
                    'needs' => ['asset', 'category'],
                    'lookup' => 'categories',
                ],
                'assigned_date' => [
                    'expr' => 'aa.assigned_date',
                    'labelKey' => 'reports.fields.assignedDate',
                    'type' => 'date',
                ],
                'expected_return_date' => [
                    'expr' => 'aa.expected_return_date',
                    'labelKey' => 'reports.fields.expectedReturn',
                    'type' => 'date',
                ],
            ],
            'defaults' => [
                'metrics' => ['count'],
                'dimensions' => ['status'],
                'fields' => ['asset_code', 'asset', 'employee', 'assigned_date', 'status'],
                'chart' => 'donut',
            ],
        ],
        'maintenance' => [
            'id' => 'maintenance',
            'labelKey' => 'reports.modules.maintenance',
            'descriptionKey' => 'reports.modules.maintenanceDesc',
            'icon' => 'build',
            'accent' => 'amber',
            'permission' => 'maintenance.view',
            'from' => 'asset_maintenances m',
            'baseWhere' => [],
            'joins' => [
                'asset' => 'LEFT JOIN assets a ON a.id = m.asset_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'department' => 'LEFT JOIN departments d ON d.id = a.department_id',
                'campus' => 'LEFT JOIN campuses cm ON cm.id = a.campus_id',
                'technician' => 'LEFT JOIN users u ON u.id = m.technician_id',
            ],
            'scope' => [
                'department' => 'a.department_id',
                'needs' => ['asset'],
            ],
            'dates' => [
                'start_date' => [
                    'expr' => 'm.start_date',
                    'labelKey' => 'reports.fields.startDate',
                ],
                'end_date' => [
                    'expr' => 'm.end_date',
                    'labelKey' => 'reports.fields.endDate',
                ],
                'scheduled_date' => [
                    'expr' => 'm.scheduled_date',
                    'labelKey' => 'reports.fields.scheduledDate',
                ],
                'created_at' => [
                    'expr' => 'm.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'created_at',
            'dimensions' => [
                'type' => [
                    'expr' => 'm.maintenance_type',
                    'labelKey' => 'reports.fields.maintenanceType',
                    'translate' => 'maintenanceType',
                ],
                'status' => [
                    'expr' => 'm.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['asset', 'category'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'needs' => ['asset'],
                ],
                'technician' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.technician',
                    'needs' => ['technician'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'needs' => ['asset', 'department'],
                ],
                'campus' => [
                    'expr' => 'cm.name',
                    'labelKey' => 'reports.fields.campus',
                    'needs' => ['asset', 'campus'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.workOrders',
                    'format' => 'integer',
                ],
                'total_cost' => [
                    'expr' => 'SUM(COALESCE(m.cost, 0))',
                    'labelKey' => 'reports.metrics.totalCost',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'avg_cost' => [
                    'expr' => 'AVG(COALESCE(m.cost, 0))',
                    'labelKey' => 'reports.metrics.averageCost',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'max_cost' => [
                    'expr' => 'MAX(COALESCE(m.cost, 0))',
                    'labelKey' => 'reports.metrics.highestCost',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'completed' => [
                    'expr' => 'SUM(CASE WHEN m.status = \'completed\' THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.completed',
                    'format' => 'integer',
                ],
                'open' => [
                    'expr' => 'SUM(CASE WHEN m.status NOT IN (\'completed\', \'cancelled\') THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.open',
                    'format' => 'integer',
                ],
                'distinct_assets' => [
                    'expr' => 'COUNT(DISTINCT m.asset_id)',
                    'labelKey' => 'reports.metrics.assetCount',
                    'format' => 'integer',
                ],
            ],
            'fields' => [
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'type' => [
                    'expr' => 'm.maintenance_type',
                    'labelKey' => 'reports.fields.maintenanceType',
                    'format' => 'text',
                    'translate' => 'maintenanceType',
                ],
                'status' => [
                    'expr' => 'm.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
                'technician' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.technician',
                    'format' => 'text',
                    'needs' => ['technician'],
                ],
                'scheduled_date' => [
                    'expr' => 'm.scheduled_date',
                    'labelKey' => 'reports.fields.scheduledDate',
                    'format' => 'date',
                ],
                'start_date' => [
                    'expr' => 'm.start_date',
                    'labelKey' => 'reports.fields.startDate',
                    'format' => 'date',
                ],
                'end_date' => [
                    'expr' => 'm.end_date',
                    'labelKey' => 'reports.fields.endDate',
                    'format' => 'date',
                ],
                'cost' => [
                    'expr' => 'm.cost',
                    'labelKey' => 'reports.fields.cost',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'result' => [
                    'expr' => 'm.result',
                    'labelKey' => 'reports.fields.result',
                    'format' => 'text',
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'm.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['requested', 'approved', 'in_progress', 'completed', 'cancelled'],
                    'translate' => 'status',
                ],
                'type' => [
                    'expr' => 'm.maintenance_type',
                    'labelKey' => 'reports.fields.maintenanceType',
                    'type' => 'enum',
                    'options' => ['preventive', 'corrective', 'emergency', 'inspection'],
                    'translate' => 'maintenanceType',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'type' => 'text',
                    'needs' => ['asset', 'category'],
                    'lookup' => 'categories',
                ],
                'technician' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.technician',
                    'type' => 'text',
                    'needs' => ['technician'],
                ],
                'cost' => [
                    'expr' => 'm.cost',
                    'labelKey' => 'reports.fields.cost',
                    'type' => 'number',
                    'financial' => true,
                ],
                'start_date' => [
                    'expr' => 'm.start_date',
                    'labelKey' => 'reports.fields.startDate',
                    'type' => 'date',
                ],
                'created_at' => [
                    'expr' => 'm.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                    'type' => 'date',
                ],
            ],
            'defaults' => [
                'metrics' => ['count', 'total_cost'],
                'dimensions' => ['type'],
                'fields' => ['asset_code', 'asset', 'type', 'status', 'start_date', 'cost'],
                'chart' => 'bar',
            ],
        ],
        'procurement' => [
            'id' => 'procurement',
            'labelKey' => 'reports.modules.procurement',
            'descriptionKey' => 'reports.modules.procurementDesc',
            'icon' => 'shopping_cart',
            'accent' => 'violet',
            'permission' => 'procurement.view',
            'from' => 'purchase_orders po',
            'baseWhere' => [],
            'joins' => [
                'supplier' => 'LEFT JOIN suppliers s ON s.id = po.supplier_id',
                'creator' => 'LEFT JOIN users u ON u.id = po.created_by',
                'request' => 'LEFT JOIN purchase_requests pr ON pr.id = po.purchase_request_id',
                'department' => 'LEFT JOIN departments d ON d.id = pr.department_id',
            ],
            'scope' => [
                'department' => 'pr.department_id',
                'needs' => ['request'],
            ],
            'dates' => [
                'order_date' => [
                    'expr' => 'po.order_date',
                    'labelKey' => 'reports.fields.orderDate',
                ],
                'expected_date' => [
                    'expr' => 'po.expected_date',
                    'labelKey' => 'reports.fields.expectedDate',
                ],
                'created_at' => [
                    'expr' => 'po.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'order_date',
            'dimensions' => [
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'needs' => ['supplier'],
                ],
                'status' => [
                    'expr' => 'po.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'created_by' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.createdBy',
                    'needs' => ['creator'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'needs' => ['request', 'department'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.orderCount',
                    'format' => 'integer',
                ],
                'total_amount' => [
                    'expr' => 'SUM(COALESCE(po.total, 0))',
                    'labelKey' => 'reports.metrics.totalAmount',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'subtotal' => [
                    'expr' => 'SUM(COALESCE(po.subtotal, 0))',
                    'labelKey' => 'reports.metrics.subtotal',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'tax' => [
                    'expr' => 'SUM(COALESCE(po.tax, 0))',
                    'labelKey' => 'reports.metrics.tax',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'avg_amount' => [
                    'expr' => 'AVG(COALESCE(po.total, 0))',
                    'labelKey' => 'reports.metrics.averageOrder',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'max_amount' => [
                    'expr' => 'MAX(COALESCE(po.total, 0))',
                    'labelKey' => 'reports.metrics.largestOrder',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'distinct_suppliers' => [
                    'expr' => 'COUNT(DISTINCT po.supplier_id)',
                    'labelKey' => 'reports.metrics.supplierCount',
                    'format' => 'integer',
                ],
            ],
            'fields' => [
                'po_number' => [
                    'expr' => 'po.po_number',
                    'labelKey' => 'reports.fields.poNumber',
                    'format' => 'text',
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'format' => 'text',
                    'needs' => ['supplier'],
                ],
                'status' => [
                    'expr' => 'po.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
                'order_date' => [
                    'expr' => 'po.order_date',
                    'labelKey' => 'reports.fields.orderDate',
                    'format' => 'date',
                ],
                'expected_date' => [
                    'expr' => 'po.expected_date',
                    'labelKey' => 'reports.fields.expectedDate',
                    'format' => 'date',
                ],
                'subtotal' => [
                    'expr' => 'po.subtotal',
                    'labelKey' => 'reports.fields.subtotal',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'tax' => [
                    'expr' => 'po.tax',
                    'labelKey' => 'reports.fields.tax',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'total' => [
                    'expr' => 'po.total',
                    'labelKey' => 'reports.fields.total',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'created_by' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.createdBy',
                    'format' => 'text',
                    'needs' => ['creator'],
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'po.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'],
                    'translate' => 'status',
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'type' => 'text',
                    'needs' => ['supplier'],
                    'lookup' => 'suppliers',
                ],
                'total' => [
                    'expr' => 'po.total',
                    'labelKey' => 'reports.fields.total',
                    'type' => 'number',
                    'financial' => true,
                ],
                'order_date' => [
                    'expr' => 'po.order_date',
                    'labelKey' => 'reports.fields.orderDate',
                    'type' => 'date',
                ],
            ],
            'defaults' => [
                'metrics' => ['count', 'total_amount'],
                'dimensions' => ['supplier'],
                'fields' => ['po_number', 'supplier', 'status', 'order_date', 'total'],
                'chart' => 'bar',
            ],
        ],
        'purchase_items' => [
            'id' => 'purchase_items',
            'labelKey' => 'reports.modules.purchaseItems',
            'descriptionKey' => 'reports.modules.purchaseItemsDesc',
            'icon' => 'list_alt',
            'accent' => 'purple',
            'permission' => 'procurement.view',
            'from' => 'purchase_order_items poi',
            'baseWhere' => [],
            'joins' => [
                'order' => 'LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id',
                'supplier' => 'LEFT JOIN suppliers s ON s.id = po.supplier_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = poi.asset_category_id',
            ],
            'dates' => [
                'order_date' => [
                    'expr' => 'po.order_date',
                    'labelKey' => 'reports.fields.orderDate',
                    'needs' => ['order'],
                ],
                'created_at' => [
                    'expr' => 'poi.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'order_date',
            'dimensions' => [
                'item' => [
                    'expr' => 'poi.name',
                    'labelKey' => 'reports.fields.item',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['category'],
                ],
                'brand' => [
                    'expr' => 'poi.brand',
                    'labelKey' => 'reports.fields.brand',
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'needs' => ['order', 'supplier'],
                ],
                'status' => [
                    'expr' => 'po.status',
                    'labelKey' => 'reports.fields.status',
                    'needs' => ['order'],
                    'translate' => 'status',
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.lineCount',
                    'format' => 'integer',
                ],
                'quantity' => [
                    'expr' => 'SUM(COALESCE(poi.quantity, 0))',
                    'labelKey' => 'reports.metrics.quantity',
                    'format' => 'integer',
                ],
                'received_quantity' => [
                    'expr' => 'SUM(COALESCE(poi.received_quantity, 0))',
                    'labelKey' => 'reports.metrics.receivedQuantity',
                    'format' => 'integer',
                ],
                'pending_quantity' => [
                    'expr' => 'SUM(COALESCE(poi.quantity, 0) - COALESCE(poi.received_quantity, 0))',
                    'labelKey' => 'reports.metrics.pendingQuantity',
                    'format' => 'integer',
                ],
                'total_amount' => [
                    'expr' => 'SUM(COALESCE(poi.quantity, 0) * COALESCE(poi.unit_price, 0))',
                    'labelKey' => 'reports.metrics.totalAmount',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'avg_unit_price' => [
                    'expr' => 'AVG(COALESCE(poi.unit_price, 0))',
                    'labelKey' => 'reports.metrics.averageUnitPrice',
                    'format' => 'currency',
                    'financial' => true,
                ],
            ],
            'fields' => [
                'item' => [
                    'expr' => 'poi.name',
                    'labelKey' => 'reports.fields.item',
                    'format' => 'text',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'format' => 'text',
                    'needs' => ['category'],
                ],
                'brand' => [
                    'expr' => 'poi.brand',
                    'labelKey' => 'reports.fields.brand',
                    'format' => 'text',
                ],
                'model' => [
                    'expr' => 'poi.model',
                    'labelKey' => 'reports.fields.model',
                    'format' => 'text',
                ],
                'quantity' => [
                    'expr' => 'poi.quantity',
                    'labelKey' => 'reports.fields.quantity',
                    'format' => 'integer',
                ],
                'received_quantity' => [
                    'expr' => 'poi.received_quantity',
                    'labelKey' => 'reports.fields.receivedQuantity',
                    'format' => 'integer',
                ],
                'unit_price' => [
                    'expr' => 'poi.unit_price',
                    'labelKey' => 'reports.fields.unitPrice',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'po_number' => [
                    'expr' => 'po.po_number',
                    'labelKey' => 'reports.fields.poNumber',
                    'format' => 'text',
                    'needs' => ['order'],
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'format' => 'text',
                    'needs' => ['order', 'supplier'],
                ],
                'order_date' => [
                    'expr' => 'po.order_date',
                    'labelKey' => 'reports.fields.orderDate',
                    'format' => 'date',
                    'needs' => ['order'],
                ],
            ],
            'filters' => [
                'item' => [
                    'expr' => 'poi.name',
                    'labelKey' => 'reports.fields.item',
                    'type' => 'text',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'type' => 'text',
                    'needs' => ['category'],
                    'lookup' => 'categories',
                ],
                'supplier' => [
                    'expr' => 's.name',
                    'labelKey' => 'reports.fields.supplier',
                    'type' => 'text',
                    'needs' => ['order', 'supplier'],
                    'lookup' => 'suppliers',
                ],
                'quantity' => [
                    'expr' => 'poi.quantity',
                    'labelKey' => 'reports.fields.quantity',
                    'type' => 'number',
                ],
                'unit_price' => [
                    'expr' => 'poi.unit_price',
                    'labelKey' => 'reports.fields.unitPrice',
                    'type' => 'number',
                    'financial' => true,
                ],
                'order_date' => [
                    'expr' => 'po.order_date',
                    'labelKey' => 'reports.fields.orderDate',
                    'type' => 'date',
                    'needs' => ['order'],
                ],
            ],
            'defaults' => [
                'metrics' => ['quantity', 'total_amount'],
                'dimensions' => ['item'],
                'fields' => ['item', 'category', 'quantity', 'unit_price', 'supplier'],
                'chart' => 'bar',
            ],
        ],
        'warehouse' => [
            'id' => 'warehouse',
            'labelKey' => 'reports.modules.warehouse',
            'descriptionKey' => 'reports.modules.warehouseDesc',
            'icon' => 'warehouse',
            'accent' => 'cyan',
            'permission' => 'warehouse.view',
            'from' => 'warehouse_transactions wt',
            'baseWhere' => [],
            'joins' => [
                'warehouse' => 'LEFT JOIN warehouses w ON w.id = wt.warehouse_id',
                'asset' => 'LEFT JOIN assets a ON a.id = wt.asset_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'user' => 'LEFT JOIN users u ON u.id = wt.user_id',
            ],
            'dates' => [
                'created_at' => [
                    'expr' => 'wt.created_at',
                    'labelKey' => 'reports.fields.transactionDate',
                ],
            ],
            'defaultDate' => 'created_at',
            'dimensions' => [
                'warehouse' => [
                    'expr' => 'w.name',
                    'labelKey' => 'reports.fields.warehouse',
                    'needs' => ['warehouse'],
                ],
                'type' => [
                    'expr' => 'wt.type',
                    'labelKey' => 'reports.fields.transactionType',
                    'translate' => 'transactionType',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['asset', 'category'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'needs' => ['asset'],
                ],
                'user' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.user',
                    'needs' => ['user'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.transactionCount',
                    'format' => 'integer',
                ],
                'quantity' => [
                    'expr' => 'SUM(COALESCE(wt.quantity, 0))',
                    'labelKey' => 'reports.metrics.quantity',
                    'format' => 'integer',
                ],
                'inbound' => [
                    'expr' => 'SUM(CASE WHEN wt.type IN (\'in\', \'receipt\', \'return\') THEN COALESCE(wt.quantity, 0) ELSE 0 END)',
                    'labelKey' => 'reports.metrics.inbound',
                    'format' => 'integer',
                ],
                'outbound' => [
                    'expr' => 'SUM(CASE WHEN wt.type IN (\'out\', \'issue\', \'transfer\') THEN COALESCE(wt.quantity, 0) ELSE 0 END)',
                    'labelKey' => 'reports.metrics.outbound',
                    'format' => 'integer',
                ],
                'distinct_assets' => [
                    'expr' => 'COUNT(DISTINCT wt.asset_id)',
                    'labelKey' => 'reports.metrics.assetCount',
                    'format' => 'integer',
                ],
            ],
            'fields' => [
                'warehouse' => [
                    'expr' => 'w.name',
                    'labelKey' => 'reports.fields.warehouse',
                    'format' => 'text',
                    'needs' => ['warehouse'],
                ],
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'type' => [
                    'expr' => 'wt.type',
                    'labelKey' => 'reports.fields.transactionType',
                    'format' => 'text',
                    'translate' => 'transactionType',
                ],
                'quantity' => [
                    'expr' => 'wt.quantity',
                    'labelKey' => 'reports.fields.quantity',
                    'format' => 'integer',
                ],
                'created_at' => [
                    'expr' => 'wt.created_at',
                    'labelKey' => 'reports.fields.transactionDate',
                    'format' => 'date',
                ],
                'user' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.user',
                    'format' => 'text',
                    'needs' => ['user'],
                ],
                'notes' => [
                    'expr' => 'wt.notes',
                    'labelKey' => 'reports.fields.notes',
                    'format' => 'text',
                ],
            ],
            'filters' => [
                'warehouse' => [
                    'expr' => 'w.name',
                    'labelKey' => 'reports.fields.warehouse',
                    'type' => 'text',
                    'needs' => ['warehouse'],
                    'lookup' => 'warehouses',
                ],
                'type' => [
                    'expr' => 'wt.type',
                    'labelKey' => 'reports.fields.transactionType',
                    'type' => 'enum',
                    'options' => ['in', 'out', 'transfer', 'adjustment', 'receipt', 'issue', 'return'],
                    'translate' => 'transactionType',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'type' => 'text',
                    'needs' => ['asset', 'category'],
                    'lookup' => 'categories',
                ],
                'created_at' => [
                    'expr' => 'wt.created_at',
                    'labelKey' => 'reports.fields.transactionDate',
                    'type' => 'date',
                ],
            ],
            'defaults' => [
                'metrics' => ['count', 'quantity'],
                'dimensions' => ['warehouse'],
                'fields' => ['warehouse', 'asset_code', 'type', 'quantity', 'created_at'],
                'chart' => 'bar',
            ],
        ],
        'depreciation' => [
            'id' => 'depreciation',
            'labelKey' => 'reports.modules.depreciation',
            'descriptionKey' => 'reports.modules.depreciationDesc',
            'icon' => 'trending_down',
            'accent' => 'indigo',
            'permission' => 'depreciation.view',
            'from' => 'asset_depreciations dp',
            'baseWhere' => [],
            'joins' => [
                'asset' => 'LEFT JOIN assets a ON a.id = dp.asset_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'method' => 'LEFT JOIN depreciation_methods dm ON dm.id = dp.method_id',
                'department' => 'LEFT JOIN departments d ON d.id = a.department_id',
            ],
            'scope' => [
                'department' => 'a.department_id',
                'needs' => ['asset'],
            ],
            'dates' => [
                'created_at' => [
                    'expr' => 'dp.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'created_at',
            'dimensions' => [
                'period' => [
                    'expr' => 'dp.period',
                    'labelKey' => 'reports.fields.period',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['asset', 'category'],
                ],
                'method' => [
                    'expr' => 'dm.name',
                    'labelKey' => 'reports.fields.method',
                    'needs' => ['method'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'needs' => ['asset'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'needs' => ['asset', 'department'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.records',
                    'format' => 'integer',
                ],
                'original_value' => [
                    'expr' => 'SUM(COALESCE(dp.original_value, 0))',
                    'labelKey' => 'reports.metrics.originalValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'annual_depreciation' => [
                    'expr' => 'SUM(COALESCE(dp.annual_depreciation, 0))',
                    'labelKey' => 'reports.metrics.annualDepreciation',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'accumulated_depreciation' => [
                    'expr' => 'SUM(COALESCE(dp.accumulated_depreciation, 0))',
                    'labelKey' => 'reports.metrics.accumulatedDepreciation',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'book_value' => [
                    'expr' => 'SUM(COALESCE(dp.book_value, 0))',
                    'labelKey' => 'reports.metrics.bookValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
            ],
            'fields' => [
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'period' => [
                    'expr' => 'dp.period',
                    'labelKey' => 'reports.fields.period',
                    'format' => 'text',
                ],
                'method' => [
                    'expr' => 'dm.name',
                    'labelKey' => 'reports.fields.method',
                    'format' => 'text',
                    'needs' => ['method'],
                ],
                'original_value' => [
                    'expr' => 'dp.original_value',
                    'labelKey' => 'reports.fields.originalValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'accumulated_depreciation' => [
                    'expr' => 'dp.accumulated_depreciation',
                    'labelKey' => 'reports.fields.accumulatedDepreciation',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'book_value' => [
                    'expr' => 'dp.book_value',
                    'labelKey' => 'reports.fields.bookValue',
                    'format' => 'currency',
                    'financial' => true,
                ],
            ],
            'filters' => [
                'period' => [
                    'expr' => 'dp.period',
                    'labelKey' => 'reports.fields.period',
                    'type' => 'text',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'type' => 'text',
                    'needs' => ['asset', 'category'],
                    'lookup' => 'categories',
                ],
                'book_value' => [
                    'expr' => 'dp.book_value',
                    'labelKey' => 'reports.fields.bookValue',
                    'type' => 'number',
                    'financial' => true,
                ],
            ],
            'defaults' => [
                'metrics' => ['book_value', 'accumulated_depreciation'],
                'dimensions' => ['period'],
                'fields' => ['asset_code', 'asset', 'period', 'original_value', 'book_value'],
                'chart' => 'line',
            ],
        ],
        'disposals' => [
            'id' => 'disposals',
            'labelKey' => 'reports.modules.disposals',
            'descriptionKey' => 'reports.modules.disposalsDesc',
            'icon' => 'delete_sweep',
            'accent' => 'rose',
            'permission' => 'assets.view',
            'from' => 'asset_disposals ad',
            'baseWhere' => [],
            'joins' => [
                'asset' => 'LEFT JOIN assets a ON a.id = ad.asset_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'approver' => 'LEFT JOIN users u ON u.id = ad.approved_by',
            ],
            'scope' => [
                'department' => 'a.department_id',
                'needs' => ['asset'],
            ],
            'dates' => [
                'disposal_date' => [
                    'expr' => 'ad.disposal_date',
                    'labelKey' => 'reports.fields.disposalDate',
                ],
                'request_date' => [
                    'expr' => 'ad.request_date',
                    'labelKey' => 'reports.fields.requestDate',
                ],
                'created_at' => [
                    'expr' => 'ad.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'disposal_date',
            'dimensions' => [
                'method' => [
                    'expr' => 'ad.method',
                    'labelKey' => 'reports.fields.disposalMethod',
                    'translate' => 'disposalMethod',
                ],
                'status' => [
                    'expr' => 'ad.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['asset', 'category'],
                ],
                'approved_by' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.approvedBy',
                    'needs' => ['approver'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.disposalCount',
                    'format' => 'integer',
                ],
                'revenue' => [
                    'expr' => 'SUM(COALESCE(ad.revenue, 0))',
                    'labelKey' => 'reports.metrics.revenue',
                    'format' => 'currency',
                    'financial' => true,
                ],
                'avg_revenue' => [
                    'expr' => 'AVG(COALESCE(ad.revenue, 0))',
                    'labelKey' => 'reports.metrics.averageRevenue',
                    'format' => 'currency',
                    'financial' => true,
                ],
            ],
            'fields' => [
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'method' => [
                    'expr' => 'ad.method',
                    'labelKey' => 'reports.fields.disposalMethod',
                    'format' => 'text',
                    'translate' => 'disposalMethod',
                ],
                'status' => [
                    'expr' => 'ad.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
                'request_date' => [
                    'expr' => 'ad.request_date',
                    'labelKey' => 'reports.fields.requestDate',
                    'format' => 'date',
                ],
                'disposal_date' => [
                    'expr' => 'ad.disposal_date',
                    'labelKey' => 'reports.fields.disposalDate',
                    'format' => 'date',
                ],
                'revenue' => [
                    'expr' => 'ad.revenue',
                    'labelKey' => 'reports.fields.revenue',
                    'format' => 'currency',
                    'financial' => true,
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'ad.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['draft', 'pending', 'approved', 'rejected', 'completed'],
                    'translate' => 'status',
                ],
                'method' => [
                    'expr' => 'ad.method',
                    'labelKey' => 'reports.fields.disposalMethod',
                    'type' => 'enum',
                    'options' => ['sold', 'scrapped', 'donated', 'recycled', 'lost'],
                    'translate' => 'disposalMethod',
                ],
                'disposal_date' => [
                    'expr' => 'ad.disposal_date',
                    'labelKey' => 'reports.fields.disposalDate',
                    'type' => 'date',
                ],
                'revenue' => [
                    'expr' => 'ad.revenue',
                    'labelKey' => 'reports.fields.revenue',
                    'type' => 'number',
                    'financial' => true,
                ],
            ],
            'defaults' => [
                'metrics' => ['count', 'revenue'],
                'dimensions' => ['method'],
                'fields' => ['asset_code', 'asset', 'method', 'status', 'disposal_date', 'revenue'],
                'chart' => 'donut',
            ],
        ],
        'incidents' => [
            'id' => 'incidents',
            'labelKey' => 'reports.modules.incidents',
            'descriptionKey' => 'reports.modules.incidentsDesc',
            'icon' => 'report_problem',
            'accent' => 'orange',
            'permission' => 'incidents.view',
            'from' => 'asset_incidents ai',
            'baseWhere' => [],
            'joins' => [
                'asset' => 'LEFT JOIN assets a ON a.id = ai.asset_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'reporter' => 'LEFT JOIN users u ON u.id = ai.reported_by',
                'department' => 'LEFT JOIN departments d ON d.id = a.department_id',
            ],
            'scope' => [
                'department' => 'a.department_id',
                'needs' => ['asset'],
            ],
            'dates' => [
                'incident_date' => [
                    'expr' => 'ai.incident_date',
                    'labelKey' => 'reports.fields.incidentDate',
                ],
                'created_at' => [
                    'expr' => 'ai.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'incident_date',
            'dimensions' => [
                'type' => [
                    'expr' => 'ai.incident_type',
                    'labelKey' => 'reports.fields.incidentType',
                    'translate' => 'incidentType',
                ],
                'status' => [
                    'expr' => 'ai.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['asset', 'category'],
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'needs' => ['asset', 'department'],
                ],
                'reported_by' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.reportedBy',
                    'needs' => ['reporter'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.incidentCount',
                    'format' => 'integer',
                ],
                'open' => [
                    'expr' => 'SUM(CASE WHEN ai.status = \'open\' THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.open',
                    'format' => 'integer',
                ],
                'resolved' => [
                    'expr' => 'SUM(CASE WHEN ai.status IN (\'resolved\', \'closed\') THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.resolved',
                    'format' => 'integer',
                ],
                'distinct_assets' => [
                    'expr' => 'COUNT(DISTINCT ai.asset_id)',
                    'labelKey' => 'reports.metrics.assetCount',
                    'format' => 'integer',
                ],
            ],
            'fields' => [
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'type' => [
                    'expr' => 'ai.incident_type',
                    'labelKey' => 'reports.fields.incidentType',
                    'format' => 'text',
                    'translate' => 'incidentType',
                ],
                'status' => [
                    'expr' => 'ai.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
                'incident_date' => [
                    'expr' => 'ai.incident_date',
                    'labelKey' => 'reports.fields.incidentDate',
                    'format' => 'date',
                ],
                'description' => [
                    'expr' => 'ai.description',
                    'labelKey' => 'reports.fields.description',
                    'format' => 'text',
                ],
                'reported_by' => [
                    'expr' => 'u.name',
                    'labelKey' => 'reports.fields.reportedBy',
                    'format' => 'text',
                    'needs' => ['reporter'],
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'ai.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['open', 'investigating', 'resolved', 'closed'],
                    'translate' => 'status',
                ],
                'type' => [
                    'expr' => 'ai.incident_type',
                    'labelKey' => 'reports.fields.incidentType',
                    'type' => 'enum',
                    'options' => ['damage', 'loss', 'theft', 'malfunction', 'other'],
                    'translate' => 'incidentType',
                ],
                'incident_date' => [
                    'expr' => 'ai.incident_date',
                    'labelKey' => 'reports.fields.incidentDate',
                    'type' => 'date',
                ],
            ],
            'defaults' => [
                'metrics' => ['count'],
                'dimensions' => ['type'],
                'fields' => ['asset_code', 'asset', 'type', 'status', 'incident_date'],
                'chart' => 'donut',
            ],
        ],
        'employees' => [
            'id' => 'employees',
            'labelKey' => 'reports.modules.employees',
            'descriptionKey' => 'reports.modules.employeesDesc',
            'icon' => 'groups',
            'accent' => 'green',
            'permission' => 'employees.view',
            'from' => 'employees e',
            'baseWhere' => ['e.deleted_at IS NULL'],
            'joins' => [
                'department' => 'LEFT JOIN departments d ON d.id = e.department_id',
                'faculty' => 'LEFT JOIN faculties f ON f.id = d.faculty_id',
            ],
            'scope' => [
                'department' => 'e.department_id',
            ],
            'dates' => [
                'hire_date' => [
                    'expr' => 'e.hire_date',
                    'labelKey' => 'reports.fields.hireDate',
                ],
                'created_at' => [
                    'expr' => 'e.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'hire_date',
            'dimensions' => [
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'needs' => ['department'],
                ],
                'faculty' => [
                    'expr' => 'f.name',
                    'labelKey' => 'reports.fields.faculty',
                    'needs' => ['department', 'faculty'],
                ],
                'status' => [
                    'expr' => 'e.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'employment_type' => [
                    'expr' => 'e.employment_type',
                    'labelKey' => 'reports.fields.employmentType',
                    'translate' => 'employmentType',
                ],
                'position' => [
                    'expr' => 'e.position',
                    'labelKey' => 'reports.fields.position',
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.employeeCount',
                    'format' => 'integer',
                ],
                'active' => [
                    'expr' => 'SUM(CASE WHEN e.status = \'active\' THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.active',
                    'format' => 'integer',
                ],
            ],
            'fields' => [
                'employee_code' => [
                    'expr' => 'e.employee_code',
                    'labelKey' => 'reports.fields.employeeCode',
                    'format' => 'text',
                ],
                'name' => [
                    'expr' => 'TRIM(COALESCE(e.first_name, \'\') || \' \' || COALESCE(e.last_name, \'\'))',
                    'labelKey' => 'reports.fields.employee',
                    'format' => 'text',
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'format' => 'text',
                    'needs' => ['department'],
                ],
                'position' => [
                    'expr' => 'e.position',
                    'labelKey' => 'reports.fields.position',
                    'format' => 'text',
                ],
                'employment_type' => [
                    'expr' => 'e.employment_type',
                    'labelKey' => 'reports.fields.employmentType',
                    'format' => 'text',
                    'translate' => 'employmentType',
                ],
                'status' => [
                    'expr' => 'e.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
                'hire_date' => [
                    'expr' => 'e.hire_date',
                    'labelKey' => 'reports.fields.hireDate',
                    'format' => 'date',
                ],
                'email' => [
                    'expr' => 'e.email',
                    'labelKey' => 'reports.fields.email',
                    'format' => 'text',
                ],
                'phone' => [
                    'expr' => 'e.phone',
                    'labelKey' => 'reports.fields.phone',
                    'format' => 'text',
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'e.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['active', 'inactive', 'on_leave', 'terminated'],
                    'translate' => 'status',
                ],
                'department' => [
                    'expr' => 'd.name',
                    'labelKey' => 'reports.fields.department',
                    'type' => 'text',
                    'needs' => ['department'],
                    'lookup' => 'departments',
                ],
                'employment_type' => [
                    'expr' => 'e.employment_type',
                    'labelKey' => 'reports.fields.employmentType',
                    'type' => 'enum',
                    'options' => ['full_time', 'part_time', 'contract', 'temporary'],
                    'translate' => 'employmentType',
                ],
                'hire_date' => [
                    'expr' => 'e.hire_date',
                    'labelKey' => 'reports.fields.hireDate',
                    'type' => 'date',
                ],
            ],
            'defaults' => [
                'metrics' => ['count'],
                'dimensions' => ['department'],
                'fields' => ['employee_code', 'name', 'department', 'position', 'status'],
                'chart' => 'bar',
            ],
        ],
        'transfers' => [
            'id' => 'transfers',
            'labelKey' => 'reports.modules.transfers',
            'descriptionKey' => 'reports.modules.transfersDesc',
            'icon' => 'swap_horiz',
            'accent' => 'slate',
            'permission' => 'assets.view',
            'from' => 'asset_transfers tr',
            'baseWhere' => [],
            'joins' => [
                'asset' => 'LEFT JOIN assets a ON a.id = tr.asset_id',
                'category' => 'LEFT JOIN asset_categories c ON c.id = a.category_id',
                'fromDept' => 'LEFT JOIN departments dfrom ON dfrom.id = tr.from_department_id',
                'toDept' => 'LEFT JOIN departments dto ON dto.id = tr.to_department_id',
            ],
            'dates' => [
                'transfer_date' => [
                    'expr' => 'tr.transfer_date',
                    'labelKey' => 'reports.fields.transferDate',
                ],
                'created_at' => [
                    'expr' => 'tr.created_at',
                    'labelKey' => 'reports.fields.createdAt',
                ],
            ],
            'defaultDate' => 'transfer_date',
            'dimensions' => [
                'status' => [
                    'expr' => 'tr.status',
                    'labelKey' => 'reports.fields.status',
                    'translate' => 'status',
                ],
                'from_department' => [
                    'expr' => 'dfrom.name',
                    'labelKey' => 'reports.fields.fromDepartment',
                    'needs' => ['fromDept'],
                ],
                'to_department' => [
                    'expr' => 'dto.name',
                    'labelKey' => 'reports.fields.toDepartment',
                    'needs' => ['toDept'],
                ],
                'category' => [
                    'expr' => 'c.name',
                    'labelKey' => 'reports.fields.category',
                    'needs' => ['asset', 'category'],
                ],
            ],
            'metrics' => [
                'count' => [
                    'expr' => 'COUNT(*)',
                    'labelKey' => 'reports.metrics.transferCount',
                    'format' => 'integer',
                ],
                'completed' => [
                    'expr' => 'SUM(CASE WHEN tr.status = \'completed\' THEN 1 ELSE 0 END)',
                    'labelKey' => 'reports.metrics.completed',
                    'format' => 'integer',
                ],
                'distinct_assets' => [
                    'expr' => 'COUNT(DISTINCT tr.asset_id)',
                    'labelKey' => 'reports.metrics.assetCount',
                    'format' => 'integer',
                ],
            ],
            'fields' => [
                'asset_code' => [
                    'expr' => 'a.asset_code',
                    'labelKey' => 'reports.fields.assetCode',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'asset' => [
                    'expr' => 'a.name',
                    'labelKey' => 'reports.fields.asset',
                    'format' => 'text',
                    'needs' => ['asset'],
                ],
                'from_department' => [
                    'expr' => 'dfrom.name',
                    'labelKey' => 'reports.fields.fromDepartment',
                    'format' => 'text',
                    'needs' => ['fromDept'],
                ],
                'to_department' => [
                    'expr' => 'dto.name',
                    'labelKey' => 'reports.fields.toDepartment',
                    'format' => 'text',
                    'needs' => ['toDept'],
                ],
                'transfer_date' => [
                    'expr' => 'tr.transfer_date',
                    'labelKey' => 'reports.fields.transferDate',
                    'format' => 'date',
                ],
                'status' => [
                    'expr' => 'tr.status',
                    'labelKey' => 'reports.fields.status',
                    'format' => 'text',
                    'translate' => 'status',
                ],
            ],
            'filters' => [
                'status' => [
                    'expr' => 'tr.status',
                    'labelKey' => 'reports.fields.status',
                    'type' => 'enum',
                    'options' => ['draft', 'pending', 'approved', 'completed', 'rejected'],
                    'translate' => 'status',
                ],
                'transfer_date' => [
                    'expr' => 'tr.transfer_date',
                    'labelKey' => 'reports.fields.transferDate',
                    'type' => 'date',
                ],
            ],
            'defaults' => [
                'metrics' => ['count'],
                'dimensions' => ['status'],
                'fields' => ['asset_code', 'asset', 'from_department', 'to_department', 'transfer_date', 'status'],
                'chart' => 'bar',
            ],
        ],
    ];
    }

    /**
     * One dataset, or null when the id is not on the allowlist.
     *
     * @return array<string, mixed>|null
     */
    public static function dataset(string $module): ?array
    {
        return self::datasets()[$module] ?? null;
    }

    /**
     * The client-safe projection: label keys, types and option lists, but never
     * a table name, a column name or a SQL fragment. Datasets and metrics the
     * caller may not read are removed entirely, so the UI cannot offer them.
     *
     * @param  callable(string): bool  $can
     * @return array<string, mixed>
     */
    public static function publicCatalog(callable $can): array
    {
        $financial = $can('reports.view_financial');
        $modules = [];

        foreach (self::datasets() as $ds) {
            if (! empty($ds['permission']) && ! $can($ds['permission'])) {
                continue;
            }

            $project = function (array $bag, bool $withOperators = false) use ($financial): array {
                $out = [];
                foreach ($bag as $id => $def) {
                    if (! empty($def['financial']) && ! $financial) {
                        continue;
                    }
                    $entry = [
                        'id' => $id,
                        'labelKey' => $def['labelKey'],
                        'type' => $def['type'] ?? $def['format'] ?? 'text',
                    ];
                    foreach (['options', 'translate', 'lookup'] as $key) {
                        if (isset($def[$key])) {
                            $entry[$key] = $def[$key];
                        }
                    }
                    if (! empty($def['financial'])) {
                        $entry['financial'] = true;
                    }
                    if ($withOperators) {
                        $type = $def['type'] ?? 'text';
                        $entry['operators'] = self::OPERATORS[$type] ?? self::OPERATORS['text'];
                    }
                    $out[] = $entry;
                }

                return $out;
            };

            $dimensions = $project($ds['dimensions'] ?? []);
            foreach (self::TIME_DIMENSIONS as $bucket) {
                $dimensions[] = [
                    'id' => $bucket,
                    'labelKey' => self::timeBucketLabelKey($bucket),
                    'type' => 'time',
                    'time' => true,
                ];
            }

            $dates = [];
            foreach ($ds['dates'] ?? [] as $id => $def) {
                $dates[] = ['id' => $id, 'labelKey' => $def['labelKey']];
            }

            $modules[] = [
                'id' => $ds['id'],
                'labelKey' => $ds['labelKey'],
                'descriptionKey' => $ds['descriptionKey'] ?? null,
                'icon' => $ds['icon'] ?? 'dataset',
                'accent' => $ds['accent'] ?? 'blue',
                'dimensions' => $dimensions,
                'metrics' => $project($ds['metrics'] ?? []),
                'fields' => $project($ds['fields'] ?? []),
                'filters' => $project($ds['filters'] ?? [], true),
                'dates' => $dates,
                'defaultDate' => $ds['defaultDate'] ?? null,
                'defaults' => $ds['defaults'] ?? [],
            ];
        }

        return [
            'modules' => $modules,
            'datePresets' => self::DATE_PRESETS,
            'operators' => self::OPERATORS,
            'chartTypes' => self::CHART_TYPES,
            'limits' => self::LIMITS,
        ];
    }
}

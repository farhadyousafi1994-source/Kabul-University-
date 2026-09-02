<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AppearanceController;
use App\Http\Controllers\Api\BackupController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DisposalController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\DepreciationController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\MaintenanceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProcurementController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Controllers\Api\WarehouseTransactionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Modules 3, 11–24 — Users/Roles, Maintenance, Incidents, Procurement,
| Warehouse, Audit, Depreciation, Disposal, Notifications, Activity Logs,
| Dashboard, Reports, Settings
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // Users & roles
    Route::get('users', [UserController::class, 'index'])->middleware('permission:users.view');
    Route::post('users', [UserController::class, 'store'])->middleware('permission:users.create');
    // Bulk import must be declared before the {user} wildcard routes.
    Route::post('users/bulk', [UserController::class, 'bulk'])->middleware('permission:users.create');
    Route::get('users/{user}', [UserController::class, 'show'])->middleware('permission:users.view');
    Route::put('users/{user}', [UserController::class, 'update'])->middleware('permission:users.update');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->middleware('permission:users.delete');
    Route::post('users/{user}/activate', [UserController::class, 'activate'])->middleware('permission:users.update');
    Route::post('users/{user}/deactivate', [UserController::class, 'deactivate'])->middleware('permission:users.update');
    Route::post('users/{user}/leave', [UserController::class, 'leave'])->middleware('permission:users.update');

    // Employees (HR directory — separate from user accounts)
    Route::get('employees', [EmployeeController::class, 'index'])->middleware('permission:employees.view');
    Route::post('employees', [EmployeeController::class, 'store'])->middleware('permission:employees.create');
    Route::get('employees/{employee}', [EmployeeController::class, 'show'])->middleware('permission:employees.view');
    Route::put('employees/{employee}', [EmployeeController::class, 'update'])->middleware('permission:employees.update');
    Route::patch('employees/{employee}', [EmployeeController::class, 'update'])->middleware('permission:employees.update');
    Route::delete('employees/{employee}', [EmployeeController::class, 'destroy'])->middleware('permission:employees.delete');
    Route::get('employees/{employee}/assets', [EmployeeController::class, 'assets'])->middleware('permission:employees.view');

    Route::get('roles', [RoleController::class, 'index'])->middleware('permission:roles.view');
    Route::get('roles/permissions', [RoleController::class, 'permissions'])->middleware('permission:roles.view');
    Route::post('roles', [RoleController::class, 'store'])->middleware('permission:roles.create');
    Route::get('roles/{role}', [RoleController::class, 'show'])->middleware('permission:roles.view');
    Route::put('roles/{role}', [RoleController::class, 'update'])->middleware('permission:roles.update');
    Route::delete('roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:roles.delete');

    // Maintenance
    Route::get('maintenance-requests', [MaintenanceController::class, 'requests'])->middleware('permission:maintenance.view');
    Route::post('maintenance-requests', [MaintenanceController::class, 'storeRequest'])->middleware('permission:maintenance.create');
    Route::post('maintenance-requests/{maintenanceRequest}/approve', [MaintenanceController::class, 'approveRequest'])->middleware('permission:maintenance.update');
    Route::get('maintenances', [MaintenanceController::class, 'index'])->middleware('permission:maintenance.view');
    Route::post('maintenances', [MaintenanceController::class, 'store'])->middleware('permission:maintenance.create');
    Route::get('maintenances/{maintenance}', [MaintenanceController::class, 'show'])->middleware('permission:maintenance.view');
    Route::patch('maintenances/{maintenance}/status', [MaintenanceController::class, 'transition'])->middleware('permission:maintenance.update');

    // Incidents
    Route::get('incidents', [IncidentController::class, 'index'])->middleware('permission:incidents.view');
    Route::post('incidents', [IncidentController::class, 'store'])->middleware('permission:incidents.create');
    Route::patch('incidents/{incident}/status', [IncidentController::class, 'updateStatus'])->middleware('permission:incidents.update');

    // Suppliers
    // Suppliers
    Route::get('suppliers', [SupplierController::class, 'index'])->middleware('permission:suppliers.view');
    Route::post('suppliers', [SupplierController::class, 'store'])->middleware('permission:suppliers.create');
    Route::get('suppliers/{supplier}', [SupplierController::class, 'show'])->middleware('permission:suppliers.view');
    Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:suppliers.update');
    Route::patch('suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:suppliers.update');
    Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware('permission:suppliers.delete');

    // Procurement
    Route::get('purchase-requests', [ProcurementController::class, 'purchaseRequests'])->middleware('permission:procurement.view');
    Route::post('purchase-requests', [ProcurementController::class, 'storePurchaseRequest'])->middleware('permission:procurement.create');
    Route::post('purchase-requests/{purchaseRequest}/approve', [ProcurementController::class, 'approvePurchaseRequest'])->middleware('permission:procurement.approve');
    Route::get('purchase-orders', [ProcurementController::class, 'purchaseOrders'])->middleware('permission:procurement.view');
    Route::post('purchase-orders', [ProcurementController::class, 'storePurchaseOrder'])->middleware('permission:procurement.create');
    Route::get('purchase-orders/{purchaseOrder}', [ProcurementController::class, 'purchaseOrderShow'])->middleware('permission:procurement.view');
    Route::post('purchase-orders/{purchaseOrder}/send', [ProcurementController::class, 'sendOrder'])->middleware('permission:procurement.update');
    Route::post('purchase-orders/{purchaseOrder}/receive', [ProcurementController::class, 'receive'])->middleware('permission:procurement.update');

    // Warehouse
    // Warehouses
    Route::get('warehouses', [WarehouseController::class, 'index'])->middleware('permission:warehouse.view');
    Route::post('warehouses', [WarehouseController::class, 'store'])->middleware('permission:warehouse.create');
    Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show'])->middleware('permission:warehouse.view');
    Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update'])->middleware('permission:warehouse.update');
    Route::patch('warehouses/{warehouse}', [WarehouseController::class, 'update'])->middleware('permission:warehouse.update');
    Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy'])->middleware('permission:warehouse.delete');
    Route::get('warehouse-transactions', [WarehouseTransactionController::class, 'index'])->middleware('permission:warehouse.view');
    Route::post('warehouse-transactions', [WarehouseTransactionController::class, 'store'])->middleware('permission:warehouse.update');
    Route::post('warehouse-transactions/transfer', [WarehouseTransactionController::class, 'transfer'])->middleware('permission:warehouse.transfer');

    // Audit
    Route::get('audits', [AuditController::class, 'index'])->middleware('permission:audit.view');
    Route::post('audits', [AuditController::class, 'store'])->middleware('permission:audit.create');
    Route::get('audits/{audit}', [AuditController::class, 'show'])->middleware('permission:audit.view');
    Route::post('audits/{audit}/start', [AuditController::class, 'start'])->middleware('permission:audit.create');
    Route::post('audits/{audit}/verify', [AuditController::class, 'verify'])->middleware('permission:audit.complete');
    Route::post('audits/{audit}/complete', [AuditController::class, 'complete'])->middleware('permission:audit.complete');
    Route::post('audits/{audit}/cancel', [AuditController::class, 'cancel'])->middleware('permission:audit.create');

    // Financial — depreciation & disposal
    Route::get('depreciation-methods', [DepreciationController::class, 'methods'])->middleware('permission:depreciation.view');
    Route::get('depreciations', [DepreciationController::class, 'index'])->middleware('permission:depreciation.view');
    Route::post('depreciations/calculate', [DepreciationController::class, 'calculate'])->middleware('permission:depreciation.calculate');
    Route::get('assets/{asset}/book-value', [DepreciationController::class, 'bookValue'])->middleware('permission:depreciation.view');
    Route::post('depreciations/run-monthly', [DepreciationController::class, 'runMonthly'])->middleware('permission:depreciation.calculate');

    Route::get('disposals', [DisposalController::class, 'index'])->middleware('permission:assets.view');
    Route::post('disposals', [DisposalController::class, 'store'])->middleware('permission:assets.dispose');
    Route::post('disposals/{disposal}/inspect', [DisposalController::class, 'inspect'])->middleware('permission:assets.dispose');
    Route::post('disposals/{disposal}/approve', [DisposalController::class, 'approve'])->middleware('permission:assets.dispose');
    Route::post('disposals/{disposal}/execute', [DisposalController::class, 'execute'])->middleware('permission:assets.dispose');

    // Notifications & activity logs
    Route::get('notifications', [NotificationController::class, 'index'])->middleware('permission:notifications.view');
    Route::post('notifications/{id}/read', [NotificationController::class, 'markRead'])->middleware('permission:notifications.view');
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead'])->middleware('permission:notifications.view');

    Route::get('activity-logs', [ActivityLogController::class, 'index'])->middleware('permission:audit.view');

    // Dashboard
    Route::get('dashboard/stats', [DashboardController::class, 'stats'])->middleware('permission:dashboard.view');
    Route::get('dashboard/charts', [DashboardController::class, 'charts'])->middleware('permission:dashboard.view');
    Route::get('dashboard/recent-activities', [DashboardController::class, 'recentActivities'])->middleware('permission:dashboard.view');
    Route::get('dashboard/upcoming', [DashboardController::class, 'upcoming'])->middleware('permission:dashboard.view');

    // Reports
    Route::get('reports', [ReportController::class, 'index'])->middleware('permission:reports.view');
    Route::get('reports/{report}/export', [ReportController::class, 'export'])->middleware('permission:reports.view')->whereIn('report', [
        'asset_register', 'assets_by_category', 'assets_by_location', 'assigned_assets',
        'available_assets', 'maintenance_history', 'maintenance_cost', 'asset_value',
        'depreciation_schedule', 'disposal_report', 'audit_missing', 'audit_damaged',
    ]);

    // Settings
    Route::get('settings', [SettingsController::class, 'index'])->middleware('permission:settings.manage');
    Route::put('settings', [SettingsController::class, 'update'])->middleware('permission:settings.manage');

    // Appearance / theme preferences (Module 24b)
    // Any authenticated user may read and edit their OWN appearance; the
    // organisation-wide defaults are gated behind `appearance.manage`.
    Route::get('appearance', [AppearanceController::class, 'index']);
    Route::put('appearance', [AppearanceController::class, 'update']);
    Route::post('appearance/reset', [AppearanceController::class, 'reset']);
    // Spatie's `permission:` middleware treats `|` as "any of these", so a
    // legacy `settings.manage` holder keeps working next to the new
    // `appearance.manage` permission.
    Route::get('admin/appearance', [AppearanceController::class, 'admin'])->middleware('permission:appearance.manage|settings.manage');
    Route::put('admin/appearance', [AppearanceController::class, 'updateAdmin'])->middleware('permission:appearance.manage|settings.manage');

    // Backup & disaster recovery (Module 29)
    Route::get('backups', [BackupController::class, 'index'])->middleware('permission:backup.view');
    Route::post('backups', [BackupController::class, 'store'])->middleware('permission:backup.create');
    Route::get('backups/fresh-template', [BackupController::class, 'freshTemplate'])->middleware('permission:backup.create');
    Route::post('backups/restore', [BackupController::class, 'restore'])->middleware('permission:backup.restore');
    Route::get('backups/{backup}/download', [BackupController::class, 'download'])
        ->name('backups.download')
        ->middleware('permission:backup.view');
    Route::delete('backups/{backup}', [BackupController::class, 'destroy'])->middleware('permission:backup.delete');
});

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Full permission matrix (Module 3).
     *
     * @var array<string, list<string>>
     */
    public const PERMISSION_GROUPS = [
        'dashboard' => ['view'],
        'users' => ['view', 'create', 'update', 'delete'],
        'roles' => ['view', 'create', 'update', 'delete'],
        'organization' => ['view', 'create', 'update', 'delete'],
        'categories' => ['view', 'create', 'update', 'delete'],
        'assets' => ['view', 'create', 'update', 'delete', 'assign', 'return', 'transfer', 'dispose'],
        'maintenance' => ['view', 'create', 'update'],
        'incidents' => ['view', 'create', 'update'],
        'suppliers' => ['view', 'create', 'update', 'delete'],
        'procurement' => ['view', 'create', 'update', 'approve'],
        'warehouse' => ['view', 'create', 'update', 'transfer'],
        'audit' => ['view', 'create', 'complete'],
        'depreciation' => ['view', 'calculate'],
        'requests' => ['view', 'create', 'approve'],
        'reports' => ['view'],
        'settings' => ['manage'],
        'notifications' => ['view'],
        'backup' => ['view', 'create', 'restore', 'delete'],
    ];

    /**
     * Role definitions.
     *
     * @var array<string, list<string>>
     */
    public const ROLES = [
        'Super Admin' => ['*'],
        'University Administrator' => ['*'],
        'Asset Manager' => [
            'dashboard.view', 'categories.view', 'categories.create', 'categories.update',
            'assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.return',
            'assets.transfer', 'assets.dispose', 'maintenance.view', 'maintenance.create',
            'maintenance.update', 'incidents.view', 'incidents.create', 'incidents.update',
            'requests.view', 'requests.create', 'requests.approve', 'audit.view', 'audit.create',
            'depreciation.view', 'reports.view', 'notifications.view',
        ],
        'Faculty Manager' => [
            'dashboard.view', 'assets.view', 'assets.assign', 'assets.return',
            'requests.view', 'requests.create', 'requests.approve',
            'maintenance.view', 'maintenance.create', 'incidents.view', 'incidents.create',
            'reports.view', 'notifications.view',
        ],
        'Department Manager' => [
            'dashboard.view', 'assets.view', 'requests.view', 'requests.create',
            'maintenance.view', 'maintenance.create', 'incidents.view', 'incidents.create',
            'notifications.view',
        ],
        'Warehouse Manager' => [
            'dashboard.view', 'assets.view', 'assets.create', 'assets.update',
            'warehouse.view', 'warehouse.create', 'warehouse.update', 'warehouse.transfer',
            'procurement.view', 'suppliers.view', 'reports.view', 'notifications.view',
        ],
        'Maintenance Technician' => [
            'dashboard.view', 'assets.view', 'maintenance.view', 'maintenance.create',
            'maintenance.update', 'notifications.view',
        ],
        'Auditor' => [
            'dashboard.view', 'assets.view', 'audit.view', 'audit.create', 'audit.complete',
            'reports.view', 'notifications.view',
        ],
        'Employee' => [
            'dashboard.view', 'assets.view', 'requests.create', 'notifications.view',
        ],
    ];

    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Permissions
        foreach (self::PERMISSION_GROUPS as $module => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate(['name' => $module.'.'.$action, 'guard_name' => 'web']);
            }
        }

        // Roles
        $all = Permission::pluck('name')->all();

        foreach (self::ROLES as $roleName => $permissions) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($permissions === ['*'] ? $all : $permissions);
        }
    }
}

<?php

namespace App\Domains\Security\Services;

use App\Domains\System\Services\ActivityLogService;
use Spatie\Permission\Models\Role;

/**
 * Module 3 — Roles & permissions management.
 */
class RoleService
{
    public static function create(array $data): Role
    {
        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);

        if (! empty($data['permissions'])) {
            $role->syncPermissions($data['permissions']);
        }

        ActivityLogService::record('created', 'Roles', Role::class, $role->id, $role->name, null, $data);

        return $role->load('permissions');
    }

    public static function update(Role $role, array $data): Role
    {
        $role->update(['name' => $data['name'] ?? $role->name]);

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($data['permissions'] ?? []);
        }

        ActivityLogService::record('updated', 'Roles', Role::class, $role->id, $role->name, null, $data);

        return $role->load('permissions');
    }

    public static function delete(Role $role): void
    {
        if ($role->name === 'Super Admin') {
            throw new \Illuminate\Validation\ValidationException(
                validator([], ['role' => 'The Super Admin role cannot be deleted.'])
            );
        }

        $label = $role->name;
        $role->delete();

        ActivityLogService::record('deleted', 'Roles', Role::class, $role->id, $label);
    }
}

<?php

namespace App\Domains\Security\Services;

use App\Domains\System\Services\ActivityLogService;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Module 3 — Users management (RBAC).
 */
class UserService
{
    public static function create(array $data): User
    {
        $user = User::create([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'employee_number' => $data['employee_number'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'status' => $data['status'] ?? User::STATUS_ACTIVE,
            'password' => Hash::make($data['password']),
        ]);

        if (! empty($data['roles'])) {
            $user->syncRoles($data['roles']);
        }

        ActivityLogService::record('created', 'Users', User::class, $user->id, $user->name, null, [
            'name' => $user->name,
            'roles' => $data['roles'] ?? [],
        ]);

        return $user->load('roles.permissions', 'department');
    }

    public static function update(User $user, array $data): User
    {
        $user->update([
            'name' => $data['name'] ?? $user->name,
            'username' => $data['username'] ?? $user->username,
            'email' => $data['email'] ?? $user->email,
            'phone' => array_key_exists('phone', $data) ? $data['phone'] : $user->phone,
            'employee_number' => array_key_exists('employee_number', $data) ? $data['employee_number'] : $user->employee_number,
            'department_id' => array_key_exists('department_id', $data) ? $data['department_id'] : $user->department_id,
            'status' => $data['status'] ?? $user->status,
        ]);

        if (! empty($data['roles'])) {
            $user->syncRoles($data['roles']);
        }

        if (! empty($data['password'])) {
            $user->update(['password' => Hash::make($data['password'])]);
        }

        ActivityLogService::record('updated', 'Users', User::class, $user->id, $user->name, null, $data);

        return $user->load('roles.permissions', 'department');
    }

    public static function activate(User $user): User
    {
        $user->update(['status' => User::STATUS_ACTIVE]);
        ActivityLogService::record('updated', 'Users', User::class, $user->id, $user->name, null, ['status' => 'active']);

        return $user->fresh();
    }

    public static function deactivate(User $user): User
    {
        $user->update(['status' => User::STATUS_INACTIVE]);

        // Invalidate existing sessions immediately.
        $user->tokens()->delete();

        ActivityLogService::record('updated', 'Users', User::class, $user->id, $user->name, null, ['status' => 'inactive']);

        return $user->fresh();
    }

    public static function delete(User $user): void
    {
        if ($user->isSuperAdmin()) {
            throw ValidationException::withMessages(['user' => ['The Super Admin account cannot be deleted.']]);
        }

        $label = $user->name;
        $user->delete();

        ActivityLogService::record('deleted', 'Users', User::class, $user->id, $label);
    }
}

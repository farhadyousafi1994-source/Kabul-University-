<?php

namespace App\Domains\Security\Services;

use App\Domains\System\Services\ActivityLogService;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

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
            'position' => $data['position'] ?? null,
            'hire_type' => $data['hire_type'] ?? 'permanent',
            'salary' => (int) ($data['salary'] ?? 0),
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
            'position' => array_key_exists('position', $data) ? $data['position'] : $user->position,
            'hire_type' => $data['hire_type'] ?? $user->hire_type,
            'salary' => array_key_exists('salary', $data) ? (int) ($data['salary'] ?? 0) : $user->salary,
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

    /**
     * Send an employee on leave (they cannot log in while on leave).
     */
    public static function leave(User $user): User
    {
        $user->update(['status' => User::STATUS_LEAVE]);
        $user->tokens()->delete();

        ActivityLogService::record('updated', 'Users', User::class, $user->id, $user->name, null, ['status' => 'leave']);

        return $user->fresh();
    }

    /**
     * Bulk-import employees from a CSV payload. Each row:
     * name, email, phone, department_id, position, hire_type, salary.
     * Returns [created, errors] where errors is [{row, reason}].
     */
    public static function bulkImport(array $rows): array
    {
        $created = 0;
        $errors = [];
        $count = User::query()->withTrashed()->count();

        foreach ($rows as $i => $row) {
            $name = trim((string) ($row['name'] ?? ''));
            $email = trim((string) ($row['email'] ?? ''));

            if ($name === '') {
                $errors[] = ['row' => $i + 2, 'reason' => 'name missing'];
                continue;
            }
            if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = ['row' => $i + 2, 'reason' => 'email missing/invalid'];
                continue;
            }

            $base = strtolower(preg_replace('/[^a-z]+/', '.', $name));
            $base = trim($base, '.') ?: ('employee' . ($count + 1));
            $username = $base;
            $suffix = 1;
            while (User::query()->withTrashed()->where('username', $username)->orWhere('email', $email)->exists()) {
                $suffix++;
                $username = $base . $suffix;
            }

            $count++;
            $user = User::create([
                'name' => $name,
                'username' => $username,
                'email' => $email,
                'phone' => $row['phone'] ?? null,
                'employee_number' => 'KU-' . str_pad((string) $count, 4, '0', STR_PAD_LEFT),
                'department_id' => $row['department_id'] ?? null,
                'position' => $row['position'] ?? null,
                'hire_type' => $row['hire_type'] ?? 'permanent',
                'salary' => (int) ($row['salary'] ?? 0),
                'status' => User::STATUS_ACTIVE,
                'password' => Hash::make('password123'),
            ]);

            $role = Role::where('name', 'Employee')->first();
            if ($role) {
                $user->assignRole($role->name);
            }

            $created++;
            ActivityLogService::record('created', 'Users (bulk import)', User::class, $user->id, $user->name);
        }

        return [$created, $errors];
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

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $roles = $this->whenLoaded('roles', fn () => $this->roles->map(fn ($role) => [
            'id' => $role->id,
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name'),
        ]), []);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'phone' => $this->phone,
            'department_id' => $this->department_id,
            'department' => $this->whenLoaded('department', fn () => [
                'id' => $this->department->id,
                'name' => $this->department->name,
            ]),
            // Optional link to the staff profile — employee data itself lives
            // in the dedicated `employees` table (single source of truth).
            'employee' => $this->whenLoaded('employee', fn () => $this->employee ? [
                'id' => $this->employee->id,
                'employee_code' => $this->employee->employee_code,
                'full_name' => $this->employee->full_name,
            ] : null),
            'status' => $this->status,
            'avatar' => $this->avatar,
            'roles' => $roles,
            'permissions' => $this->whenLoaded('roles', fn () => $this->getAllPermissions()->pluck('name')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

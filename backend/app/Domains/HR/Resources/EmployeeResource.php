<?php

namespace App\Domains\HR\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_code' => $this->employee_code,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'department_id' => $this->department_id,
            'department_name' => $this->whenLoaded('department', fn () => $this->department?->name),
            'faculty_name' => $this->whenLoaded('department', fn () => $this->department?->faculty?->name),
            'position' => $this->position,
            'job_title' => $this->job_title,
            'employment_type' => $this->employment_type,
            'status' => $this->status,
            'hire_date' => $this->hire_date?->toDateString(),
            'manager_id' => $this->manager_id,
            'manager_name' => $this->whenLoaded('manager', fn () => $this->manager?->full_name),
            'address' => $this->address,
            'notes' => $this->notes,
            'user_id' => $this->user_id,
            'user_username' => $this->whenLoaded('user', fn () => $this->user?->username),
            'assets_count' => $this->whenCounted('assets'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

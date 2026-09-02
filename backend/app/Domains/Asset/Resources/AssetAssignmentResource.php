<?php

namespace App\Domains\Asset\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetAssignmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            // The employee who received the asset (employees table).
            'employee_id' => $this->employee_id,
            'employee' => $this->whenLoaded('employee', fn () => $this->employee ? [
                'id' => $this->employee->id,
                'employee_code' => $this->employee->employee_code,
                'full_name' => $this->employee->full_name,
                'department_name' => $this->employee->department?->name,
            ] : null),
            // Legacy mirror of the employee's linked login account.
            'assigned_to_user_id' => $this->assigned_to_user_id,
            'assigned_by' => $this->assigned_by,
            'assigned_date' => $this->assigned_date,
            'expected_return_date' => $this->expected_return_date,
            'returned_date' => $this->returned_date,
            'condition_on_return' => $this->condition_on_return,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

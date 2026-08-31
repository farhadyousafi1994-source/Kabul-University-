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

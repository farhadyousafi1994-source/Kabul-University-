<?php

namespace App\Domains\Maintenance\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetMaintenanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'maintenance_request_id' => $this->maintenance_request_id,
            'asset_id' => $this->asset_id,
            'technician_id' => $this->technician_id,
            'maintenance_type' => $this->maintenance_type,
            'scheduled_date' => $this->scheduled_date,
            'start_date' => $this->start_date,
            'end_date' => $this->end_date,
            'cost' => $this->cost,
            'notes' => $this->notes,
            'result' => $this->result,
            'status' => $this->status,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

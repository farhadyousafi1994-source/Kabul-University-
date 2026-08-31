<?php

namespace App\Domains\Maintenance\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetIncidentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'incident_type' => $this->incident_type,
            'description' => $this->description,
            'incident_date' => $this->incident_date,
            'reported_by' => $this->reported_by,
            'status' => $this->status,
            'resolution' => $this->resolution,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

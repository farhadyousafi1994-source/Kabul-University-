<?php

namespace App\Domains\Asset\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'request_number' => $this->request_number,
            'requester_id' => $this->requester_id,
            'department_id' => $this->department_id,
            'request_type' => $this->request_type,
            'asset_category_id' => $this->asset_category_id,
            'quantity' => $this->quantity,
            'reason' => $this->reason,
            'status' => $this->status,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

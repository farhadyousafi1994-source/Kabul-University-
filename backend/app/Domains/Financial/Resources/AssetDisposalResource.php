<?php

namespace App\Domains\Financial\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetDisposalResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'method' => $this->method,
            'requested_by' => $this->requested_by,
            'approved_by' => $this->approved_by,
            'request_date' => $this->request_date,
            'approval_date' => $this->approval_date,
            'disposal_date' => $this->disposal_date,
            'status' => $this->status,
            'revenue' => $this->revenue,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

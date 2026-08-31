<?php

namespace App\Domains\Audit\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetAuditItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_audit_id' => $this->asset_audit_id,
            'asset_id' => $this->asset_id,
            'scanned_at' => $this->scanned_at,
            'verification' => $this->verification,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

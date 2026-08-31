<?php

namespace App\Domains\Audit\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetAuditResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'audit_code' => $this->audit_code,
            'auditor_id' => $this->auditor_id,
            'scope_type' => $this->scope_type,
            'scope_id' => $this->scope_id,
            'scheduled_at' => $this->scheduled_at,
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
            'status' => $this->status,
            'summary' => $this->summary,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

<?php

namespace App\Domains\Warehouse\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WarehouseTransactionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'warehouse_id' => $this->warehouse_id,
            'type' => $this->type,
            'quantity' => $this->quantity,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'user_id' => $this->user_id,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

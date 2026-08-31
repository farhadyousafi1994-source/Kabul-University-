<?php

namespace App\Domains\Procurement\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'purchase_order_id' => $this->purchase_order_id,
            'asset_category_id' => $this->asset_category_id,
            'name' => $this->name,
            'brand' => $this->brand,
            'model' => $this->model,
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price,
            'received_quantity' => $this->received_quantity,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

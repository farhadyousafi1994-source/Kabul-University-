<?php

namespace App\Domains\Procurement\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'po_number' => $this->po_number,
            'purchase_request_id' => $this->purchase_request_id,
            'supplier_id' => $this->supplier_id,
            'status' => $this->status,
            'order_date' => $this->order_date,
            'expected_date' => $this->expected_date,
            'subtotal' => $this->subtotal,
            'tax' => $this->tax,
            'total' => $this->total,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

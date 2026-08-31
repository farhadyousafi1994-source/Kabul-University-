<?php

namespace App\Domains\Procurement\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PurchaseOrderRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'purchase_request_id' => ['nullable', 'integer', 'exists:purchase_requests,id'],
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'order_date' => ['nullable', 'date'],
            'expected_date' => ['nullable', 'date'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.asset_category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'items.*.brand' => ['nullable', 'string', 'max:100'],
            'items.*.model' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ];
    }
}

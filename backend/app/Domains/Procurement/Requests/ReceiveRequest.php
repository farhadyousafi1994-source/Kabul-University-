<?php

namespace App\Domains\Procurement\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReceiveRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'received_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}

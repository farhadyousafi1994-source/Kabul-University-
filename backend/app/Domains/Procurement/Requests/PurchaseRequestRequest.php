<?php

namespace App\Domains\Procurement\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PurchaseRequestRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'notes' => ['nullable', 'string'],
        ];
    }
}

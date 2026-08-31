<?php

namespace App\Domains\Warehouse\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WarehouseRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:24', Rule::unique('warehouses,code')->ignore($this->route('warehouse'))],
            'name' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'keeper_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }
}

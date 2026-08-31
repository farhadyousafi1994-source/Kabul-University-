<?php

namespace App\Domains\Organization\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FloorRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'building_id' => ['required', 'integer', 'exists:buildings,id'],
            'code' => ['required', 'string', 'max:32', Rule::unique('floors,code')->ignore($this->route('floor'))],
            'name' => ['required', 'string', 'max:255'],
            'level' => ['sometimes', 'integer', 'min:-10', 'max:200'],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }
}

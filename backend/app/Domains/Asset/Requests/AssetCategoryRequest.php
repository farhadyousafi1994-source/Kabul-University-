<?php

namespace App\Domains\Asset\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssetCategoryRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:24', Rule::unique('asset_categories,code')->ignore($this->route('category'))],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }
}

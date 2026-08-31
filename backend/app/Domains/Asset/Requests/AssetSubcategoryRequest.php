<?php

namespace App\Domains\Asset\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssetSubcategoryRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:asset_categories,id'],
            'code' => ['required', 'string', 'max:32', Rule::unique('asset_subcategories,code')->ignore($this->route('subcategory'))],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }
}

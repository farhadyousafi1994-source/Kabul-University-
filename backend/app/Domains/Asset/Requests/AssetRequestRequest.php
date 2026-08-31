<?php

namespace App\Domains\Asset\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssetRequestRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'request_type' => ['required', 'in:new_asset,temporary_asset,replacement_asset,repair_request'],
            'asset_category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'reason' => ['nullable', 'string'],
        ];
    }
}

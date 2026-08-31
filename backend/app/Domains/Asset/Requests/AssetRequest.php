<?php

namespace App\Domains\Asset\Requests;

use App\Domains\Asset\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssetRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer', 'exists:asset_categories,id'],
            'subcategory_id' => ['nullable', 'integer', 'exists:asset_subcategories,id'],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['nullable', 'string', 'max:100', Rule::unique('assets', 'serial_number')->ignore($this->route('asset'))],
            'purchase_date' => ['nullable', 'date'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'current_value' => ['nullable', 'numeric', 'min:0'],
            'salvage_value' => ['nullable', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'warranty_expiry_date' => ['nullable', 'date', 'after_or_equal:purchase_date'],
            'useful_life' => ['nullable', 'integer', 'min:1', 'max:100'],
            'status' => ['sometimes', Rule::in(Asset::STATUSES)],
            'condition' => ['sometimes', Rule::in(Asset::CONDITIONS)],
            'campus_id' => ['nullable', 'integer', 'exists:campuses,id'],
            'faculty_id' => ['nullable', 'integer', 'exists:faculties,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'floor_id' => ['nullable', 'integer', 'exists:floors,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
        ];
    }
}

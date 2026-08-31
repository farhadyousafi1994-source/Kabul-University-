<?php

namespace App\Domains\Maintenance\Requests;

use App\Domains\Maintenance\Models\AssetMaintenance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WorkOrderRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'maintenance_request_id' => ['nullable', 'integer', 'exists:maintenance_requests,id'],
            'technician_id' => ['nullable', 'integer', 'exists:users,id'],
            'maintenance_type' => ['required', Rule::in(AssetMaintenance::TYPES)],
            'scheduled_date' => ['nullable', 'date'],
            'start_date' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }
}

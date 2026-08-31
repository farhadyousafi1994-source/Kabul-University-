<?php

namespace App\Domains\Maintenance\Requests;

use App\Domains\Maintenance\Models\AssetMaintenance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WorkOrderStatusRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(AssetMaintenance::STATUSES)],
            'technician_id' => ['nullable', 'integer', 'exists:users,id'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'result' => ['nullable', 'string'],
            'condition' => ['nullable', 'string'],
        ];
    }
}

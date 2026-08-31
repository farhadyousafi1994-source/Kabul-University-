<?php

namespace App\Domains\Maintenance\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MaintenanceRequestRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'maintenance_type' => ['required', 'in:preventive,corrective,emergency,inspection'],
            'priority' => ['sometimes', 'in:low,medium,high,urgent'],
            'problem' => ['required', 'string'],
        ];
    }
}

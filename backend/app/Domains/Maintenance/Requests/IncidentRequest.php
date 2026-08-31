<?php

namespace App\Domains\Maintenance\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IncidentRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'incident_type' => ['required', 'in:damaged,lost,stolen,destroyed'],
            'description' => ['required', 'string'],
            'incident_date' => ['sometimes', 'date'],
        ];
    }
}

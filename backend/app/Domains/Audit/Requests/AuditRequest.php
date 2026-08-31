<?php

namespace App\Domains\Audit\Requests;

use App\Domains\Audit\Models\AssetAudit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AuditRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'auditor_id' => ['nullable', 'integer', 'exists:users,id'],
            'scope_type' => ['nullable', Rule::in(AssetAudit::SCOPE_TYPES)],
            'scope_id' => ['nullable', 'integer'],
            'scheduled_at' => ['nullable', 'date'],
        ];
    }
}

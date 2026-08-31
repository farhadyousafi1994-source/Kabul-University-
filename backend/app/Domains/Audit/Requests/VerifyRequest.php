<?php

namespace App\Domains\Audit\Requests;

use App\Domains\Audit\Models\AssetAuditItem;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VerifyRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'verification' => ['required', Rule::in(AssetAuditItem::VERIFICATIONS)],
            'notes' => ['nullable', 'string'],
        ];
    }
}

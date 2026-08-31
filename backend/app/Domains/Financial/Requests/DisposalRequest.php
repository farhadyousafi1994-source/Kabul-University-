<?php

namespace App\Domains\Financial\Requests;

use App\Domains\Financial\Models\AssetDisposal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DisposalRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'method' => ['required', Rule::in(AssetDisposal::METHODS)],
            'notes' => ['nullable', 'string'],
        ];
    }
}

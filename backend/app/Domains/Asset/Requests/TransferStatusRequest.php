<?php

namespace App\Domains\Asset\Requests;

use App\Domains\Asset\Models\AssetTransfer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransferStatusRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(AssetTransfer::STATUSES)],
        ];
    }
}

<?php

namespace App\Domains\Asset\Requests;

use App\Domains\Asset\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReturnRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'condition_on_return' => ['required', Rule::in(Asset::CONDITIONS)],
            'notes' => ['nullable', 'string', 'max:1000'],
            'returned_date' => ['nullable', 'date'],
        ];
    }
}

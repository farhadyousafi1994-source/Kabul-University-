<?php

namespace App\Domains\System\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SettingsRequest extends FormRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'university_name' => ['nullable', 'string', 'max:255'],
            'university_logo' => ['nullable', 'string', 'max:255'],
            'university_address' => ['nullable', 'string'],
            'university_phone' => ['nullable', 'string', 'max:32'],
            'university_email' => ['nullable', 'email', 'max:255'],
            'default_currency' => ['nullable', 'string', 'max:8'],
            'date_format' => ['nullable', 'string', 'max:32'],
            'pagination' => ['nullable', 'integer', 'min:5', 'max:100'],
            'asset_code_format' => ['nullable', 'string', 'max:64'],
            'default_useful_life' => ['nullable', 'integer', 'min:1', 'max:100'],
            'depreciation_method' => ['nullable', 'string', 'max:8'],
        ];
    }
}

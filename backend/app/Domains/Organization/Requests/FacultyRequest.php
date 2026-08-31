<?php

namespace App\Domains\Organization\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FacultyRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'code' => ['required', 'string', 'max:32', Rule::unique('faculties,code')->ignore($this->route('faculty'))],
            'name' => ['required', 'string', 'max:255'],
            'dean' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }
}

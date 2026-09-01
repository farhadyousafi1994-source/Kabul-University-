<?php

namespace App\Domains\Security\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $userId = $this->route('user');

        return [
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', Rule::unique('users', 'username')->ignore($userId)],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'phone' => ['nullable', 'string', 'max:32'],
            'employee_number' => ['nullable', 'string', 'max:32', Rule::unique('users', 'employee_number')->ignore($userId)],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'position' => ['nullable', 'string', 'max:255'],
            'hire_type' => ['sometimes', Rule::in(['permanent', 'contract'])],
            'salary' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'leave'])],
            'password' => [$this->isMethod('post') ? 'required' : 'nullable', 'string', Password::min(8)->mixedCase()],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string', 'exists:roles,name'],
        ];
    }
}

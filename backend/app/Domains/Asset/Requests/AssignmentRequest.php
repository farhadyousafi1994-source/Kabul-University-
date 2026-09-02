<?php

namespace App\Domains\Asset\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignmentRequest extends FormRequest
{
    /**
     * The assignee is an EMPLOYEE from the dedicated `employees` table.
     * `employee_id` is the primary field; `assigned_to_user_id` remains
     * accepted for backward compatibility and is resolved through the
     * employee ↔ user link.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required_without:assigned_to_user_id', 'nullable', 'integer', 'exists:employees,id'],
            'assigned_to_user_id' => ['required_without:employee_id', 'nullable', 'integer', 'exists:users,id'],
            'expected_return_date' => ['nullable', 'date', 'after_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'employee_id.required_without' => 'The employee field is required.',
            'assigned_to_user_id.required_without' => 'The employee field is required.',
            'employee_id.exists' => 'The selected employee does not exist.',
            'assigned_to_user_id.exists' => 'The selected employee does not exist.',
        ];
    }
}

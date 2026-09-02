<?php

namespace App\Domains\Asset\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignmentRequest extends FormRequest
{
    /**
     * The assignee is an EMPLOYEE from the dedicated `employees` table.
     * `assigned_to_user_id` is never an assignment input — it is written
     * later as an optional audit mirror of `employees.user_id`.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
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
            'employee_id.required' => 'The employee field is required.',
            'employee_id.exists' => 'The selected employee does not exist.',
        ];
    }
}

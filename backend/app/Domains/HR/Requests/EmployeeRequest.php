<?php

namespace App\Domains\HR\Requests;

use App\Domains\HR\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EmployeeRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $employee = $this->route('employee');

        return [
            'employee_code' => ['sometimes', 'nullable', 'string', 'max:50', Rule::unique('employees', 'employee_code')->ignore($employee)],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('employees', 'email')->ignore($employee)],
            'phone' => ['nullable', 'string', 'max:50'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'position' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employment_type' => ['sometimes', Rule::in(Employee::EMPLOYMENT_TYPES)],
            'status' => ['sometimes', Rule::in(Employee::STATUSES)],
            'hire_date' => ['nullable', 'date'],
            'manager_id' => [
                'nullable',
                'integer',
                'exists:employees,id',
                Rule::notIn([$employee?->id]),
            ],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', Rule::unique('employees', 'user_id')->ignore($employee)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'manager_id.not_in' => 'An employee cannot manage themselves.',
            'user_id.unique' => 'This user account is already linked to another employee.',
        ];
    }
}

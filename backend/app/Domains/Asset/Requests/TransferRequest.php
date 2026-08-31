<?php

namespace App\Domains\Asset\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TransferRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'to_campus_id' => ['nullable', 'integer', 'exists:campuses,id'],
            'to_faculty_id' => ['nullable', 'integer', 'exists:faculties,id'],
            'to_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'to_building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'to_floor_id' => ['nullable', 'integer', 'exists:floors,id'],
            'to_room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'transfer_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}

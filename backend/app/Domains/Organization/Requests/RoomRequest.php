<?php

namespace App\Domains\Organization\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoomRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'floor_id' => ['required', 'integer', 'exists:floors,id'],
            'code' => ['required', 'string', 'max:32', Rule::unique('rooms,code')->ignore($this->route('room'))],
            'name' => ['required', 'string', 'max:255'],
            'room_type' => ['sometimes', 'in:office,laboratory,library,warehouse,classroom,general'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }
}

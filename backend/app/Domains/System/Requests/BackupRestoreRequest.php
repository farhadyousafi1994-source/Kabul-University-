<?php

namespace App\Domains\System\Requests;

use App\Domains\System\Services\BackupService;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Module 29 — Restore payload validation.
 *
 * The uploaded snapshot is a JSON document produced by KU-AMS:
 *   { "format": "ku-ams-backup", "tables": { "<table>": [ { … } ] } }
 */
class BackupRestoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Route-level `permission:backup.restore` middleware guards access.
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'data' => ['required', 'array'],
            'data.tables' => ['required', 'array', 'min:1'],
            'data.format' => ['nullable', 'string', 'max:64'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'data.required' => 'A backup file is required.',
            'data.tables.required' => 'The file is not a valid KU-AMS backup snapshot.',
            'data.tables.min' => 'The backup file contains no tables.',
        ];
    }

    /**
     * Reject payloads that parse as JSON but are not KU-AMS snapshots.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            if (! BackupService::isValidDump($this->input('data'))) {
                $validator->errors()->add('data', 'The file is not a valid KU-AMS backup snapshot.');
            }
        });
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors(),
        ], 422));
    }
}

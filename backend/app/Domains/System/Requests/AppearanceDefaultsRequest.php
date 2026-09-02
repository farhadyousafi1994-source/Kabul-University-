<?php

namespace App\Domains\System\Requests;

use App\Domains\System\Models\UserAppearance;
use App\Domains\System\Services\AppearanceService;

/**
 * Module 24b — organisation-wide default appearance + branding.
 *
 * Accepted shapes:
 *   { ...preferences, branding: { organization_name, brand_name, logo_url, favicon_url } }
 *   { defaults: { ...preferences }, branding: { … } }
 */
class AppearanceDefaultsRequest extends AppearanceRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && AppearanceService::canManageSystem($user);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'defaults' => ['sometimes', 'nullable', 'array'],
            'branding' => ['sometimes', 'nullable', 'array'],
            'branding.organization_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'branding.brand_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'branding.logo_url' => ['sometimes', 'nullable', 'string', 'max:255'],
            'branding.favicon_url' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'branding.organization_name.max' => 'Must not exceed 255 characters.',
            'branding.brand_name.max' => 'Must not exceed 255 characters.',
            'branding.logo_url.max' => 'Must not exceed 255 characters.',
            'branding.favicon_url.max' => 'Must not exceed 255 characters.',
        ];
    }

    /**
     * Preferences may arrive at the top level or nested under `defaults`.
     *
     * @return array<string, mixed>
     */
    public function preferences(): array
    {
        $nested = $this->input('defaults');

        if (is_array($nested) && $nested !== []) {
            return array_intersect_key($nested, array_flip(UserAppearance::FIELDS));
        }

        return parent::preferences();
    }

    /**
     * @return array<string, mixed>
     */
    public function branding(): array
    {
        $branding = $this->input('branding');

        return is_array($branding) ? $branding : [];
    }
}

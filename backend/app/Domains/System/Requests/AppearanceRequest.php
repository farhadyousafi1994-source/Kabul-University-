<?php

namespace App\Domains\System\Requests;

use App\Domains\System\Services\AppearanceService;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Module 24b — the signed-in user's own Theme & Appearance preferences.
 *
 * Every field is optional: a partial payload only touches what was sent, so
 * saving one section can never wipe another. Values are whitelisted against
 * AppearanceService (which mirrors `src/config/themes.js`) rather than stored
 * raw, so an unsupported token can never reach the CSS layer.
 */
class AppearanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Any authenticated user may edit their own appearance.
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'theme_mode' => ['sometimes', 'nullable', Rule::in(AppearanceService::MODES)],
            'selected_theme' => ['sometimes', 'nullable', 'string', 'max:64'],
            'custom_colors' => ['sometimes', 'nullable', 'array'],
            'font_family' => ['sometimes', 'nullable', Rule::in(AppearanceService::FONT_FAMILIES)],
            'font_size' => ['sometimes', 'nullable', Rule::in(AppearanceService::FONT_SIZES)],
            'font_weight' => ['sometimes', 'nullable', 'integer', Rule::in(AppearanceService::FONT_WEIGHTS)],
            'line_height' => ['sometimes', 'nullable', 'numeric', 'between:1,2.5'],
            'border_radius' => ['sometimes', 'nullable', Rule::in(AppearanceService::RADII)],
            'sidebar_style' => ['sometimes', 'nullable', Rule::in(AppearanceService::SIDEBAR_STYLES)],
            'table_density' => ['sometimes', 'nullable', Rule::in(AppearanceService::DENSITIES)],
            'animations_enabled' => ['sometimes', 'nullable', 'boolean'],
            'calendar_type' => ['sometimes', 'nullable', Rule::in(AppearanceService::CALENDARS)],
            'layout_preferences' => ['sometimes', 'nullable', 'array'],
            'layout_preferences.header' => ['sometimes', 'nullable', Rule::in(AppearanceService::HEADER_MODES)],
            'layout_preferences.contentWidth' => ['sometimes', 'nullable', Rule::in(AppearanceService::CONTENT_WIDTHS)],
            'layout_preferences.dashboardDensity' => ['sometimes', 'nullable', Rule::in(AppearanceService::DENSITIES)],
            'accessibility_preferences' => ['sometimes', 'nullable', 'array'],
            'accessibility_preferences.highContrast' => ['sometimes', 'nullable', 'boolean'],
            'accessibility_preferences.reducedMotion' => ['sometimes', 'nullable', 'boolean'],
            'accessibility_preferences.largerText' => ['sometimes', 'nullable', 'boolean'],
            'accessibility_preferences.strongFocus' => ['sometimes', 'nullable', 'boolean'],
            'accessibility_preferences.keyboardNav' => ['sometimes', 'nullable', 'boolean'],

            // Each override is `token => #hex | null`; `null` clears it.
            'custom_colors.*' => [
                'sometimes',
                'nullable',
                'string',
                'regex:/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $token = str_replace('custom_colors.', '', $attribute);

                    if (! in_array($token, AppearanceService::COLOR_TOKENS, true)) {
                        $fail(sprintf('Unknown colour token "%s".', $token));
                    }
                },
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'theme_mode.in' => 'The selected display mode is not supported.',
            'font_family.in' => 'The selected font family is not available.',
            'font_size.in' => 'The selected font size is not supported.',
            'font_weight.in' => 'The font weight must be between 300 and 800.',
            'line_height.between' => 'The line height must be between 1 and 2.5.',
            'border_radius.in' => 'The selected corner radius is not supported.',
            'sidebar_style.in' => 'The selected sidebar style is not supported.',
            'table_density.in' => 'The selected table density is not supported.',
            'calendar_type.in' => 'The selected calendar is not supported.',
            'custom_colors.*.regex' => 'Custom colours must be valid hex values (e.g. #2E7D32).',
        ];
    }

    /**
     * Only the whitelisted preference fields, with JSON columns ready to save.
     *
     * @return array<string, mixed>
     */
    public function preferences(): array
    {
        return $this->presentFields([
            'theme_mode',
            'selected_theme',
            'custom_colors',
            'font_family',
            'font_size',
            'font_weight',
            'line_height',
            'border_radius',
            'sidebar_style',
            'table_density',
            'animations_enabled',
            'calendar_type',
            'layout_preferences',
            'accessibility_preferences',
        ]);
    }

    /**
     * Only the keys the client actually sent.
     *
     * Deliberately NOT `Request::only()`, which drops explicit `null` values:
     * `custom_colors: null` is a real instruction ("clear every colour
     * override") and must reach the model.
     *
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    protected function presentFields(array $fields): array
    {
        $all = $this->all();

        $values = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $all)) {
                $values[$field] = $all[$field];
            }
        }

        return $values;
    }
}

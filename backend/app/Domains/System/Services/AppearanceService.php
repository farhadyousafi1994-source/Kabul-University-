<?php

namespace App\Domains\System\Services;

use App\Domains\System\Models\AppearanceDefault;
use App\Domains\System\Models\UserAppearance;
use App\Models\User;

/**
 * Module 24b — Theme & Appearance.
 *
 * Owns every allowed value so the request rules, the resource payload and the
 * frontend (`src/config/themes.js`) can never drift apart, and resolves the
 * "user override → organisation default" fallback chain in one place.
 */
class AppearanceService
{
    /** @var list<string> */
    public const MODES = ['light', 'dark', 'system'];

    /** @var list<string> */
    public const FONT_SIZES = ['S', 'M', 'L', 'XL'];

    /** @var list<string> */
    public const RADII = ['sharp', 'normal', 'round'];

    /** @var list<string> */
    public const SIDEBAR_STYLES = ['mini', 'normal', 'expanded', 'floating'];

    /** @var list<string> */
    public const DENSITIES = ['compact', 'comfortable', 'spacious'];

    /** @var list<string> */
    public const CALENDARS = ['gregorian', 'solar'];

    /** @var list<string> */
    public const FONT_FAMILIES = ['inter', 'roboto', 'poppins', 'open-sans', 'noto-sans', 'arial'];

    /** @var list<int> */
    public const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800];

    /** @var list<string> */
    public const HEADER_MODES = ['fixed', 'static', 'sticky'];

    /** @var list<string> */
    public const CONTENT_WIDTHS = ['boxed', 'full'];

    /** Colour tokens a user may override (must match COLOR_TOKENS). */
    public const COLOR_TOKENS = [
        'topBarStart', 'topBarEnd', 'sidebarBackground', 'sidebarActive',
        'primary', 'secondary', 'accent', 'accentBackground',
        'background', 'surface', 'card',
        'text', 'textSecondary',
        'border', 'hover', 'focus',
        'positive', 'negative', 'warning', 'info',
    ];

    /**
     * Save (or create) the signed-in user's appearance row.
     *
     * Only keys present in `$attributes` are written, so a partial PATCH-style
     * payload never wipes the rest of the user's preferences.
     *
     * @param  array<string, mixed>  $attributes
     */
    public static function saveForUser(User $user, array $attributes): UserAppearance
    {
        $values = array_intersect_key($attributes, array_flip(UserAppearance::FIELDS));

        /** @var UserAppearance $appearance */
        $appearance = UserAppearance::query()->firstOrNew(['user_id' => $user->id]);
        $appearance->fill($values);
        $appearance->save();

        return $appearance;
    }

    /**
     * Delete the user's overrides so they fall back to the organisation
     * default again.
     */
    public static function resetForUser(User $user): void
    {
        UserAppearance::query()->whereKey($user->id)->delete();
    }

    public static function forUser(User $user): ?UserAppearance
    {
        return UserAppearance::query()->find($user->id);
    }

    public static function defaults(): AppearanceDefault
    {
        return AppearanceDefault::instance();
    }

    /**
     * Update the organisation-wide defaults + branding.
     *
     * @param  array<string, mixed>  $attributes  preference fields
     * @param  array<string, mixed>  $branding    organization_name / brand_name / logo_url / favicon_url
     */
    public static function saveDefaults(array $attributes, array $branding = [], ?User $updatedBy = null): AppearanceDefault
    {
        $defaults = AppearanceDefault::instance();

        $values = array_intersect_key($attributes, array_flip(UserAppearance::FIELDS));
        $brand = array_intersect_key($branding, array_flip(AppearanceDefault::BRAND_FIELDS));

        // Empty branding strings mean "remove the override", not "store ''".
        foreach ($brand as $key => $value) {
            $brand[$key] = is_string($value) && trim($value) === '' ? null : $value;
        }

        $defaults->fill([...$values, ...$brand]);

        if ($updatedBy) {
            $defaults->updated_by = $updatedBy->id;
        }

        $defaults->save();

        return $defaults->refresh();
    }

    /**
     * `user_appearances` / `appearance_defaults` row → the API shape consumed
     * by the theme store. JSON columns are decoded and types are normalised so
     * the frontend never has to guess.
     *
     * @return array<string, mixed>|null
     */
    public static function serialise(UserAppearance|AppearanceDefault|null $row): ?array
    {
        if (! $row) {
            return null;
        }

        return [
            'theme_mode' => $row->theme_mode,
            'selected_theme' => $row->selected_theme,
            'custom_colors' => $row->custom_colors,
            'font_family' => $row->font_family,
            'font_size' => $row->font_size,
            'font_weight' => (int) ($row->font_weight ?? 400),
            'line_height' => (float) ($row->line_height ?? 1.5),
            'border_radius' => $row->border_radius,
            'sidebar_style' => $row->sidebar_style,
            'table_density' => $row->table_density,
            'animations_enabled' => (bool) $row->animations_enabled,
            'calendar_type' => $row->calendar_type,
            'layout_preferences' => $row->layout_preferences ?? (object) [],
            'accessibility_preferences' => $row->accessibility_preferences ?? (object) [],
        ];
    }

    /**
     * Defaults plus the branding block (admins only).
     *
     * @return array<string, mixed>|null
     */
    public static function serialiseDefaults(AppearanceDefault|null $row): ?array
    {
        $base = self::serialise($row);

        if (! $row || $base === null) {
            return null;
        }

        return [
            ...$base,
            'organization_name' => (string) ($row->organization_name ?? ''),
            'brand_name' => (string) ($row->brand_name ?? ''),
            'logo_url' => (string) ($row->logo_url ?? ''),
            'favicon_url' => (string) ($row->favicon_url ?? ''),
        ];
    }

    /**
     * Branding in the camelCase shape the shell components expect.
     *
     * @return array<string, string>
     */
    public static function branding(?AppearanceDefault $row): array
    {
        return [
            'organizationName' => (string) ($row?->organization_name ?? ''),
            'brandName' => (string) ($row?->brand_name ?? ''),
            'logoUrl' => (string) ($row?->logo_url ?? ''),
            'faviconUrl' => (string) ($row?->favicon_url ?? ''),
        ];
    }

    /**
     * Can this user edit the organisation-wide defaults?
     */
    public static function canManageSystem(User $user): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        // `getAllPermissions()` (roles + direct) rather than `hasPermissionTo()`
        // so a missing permission row can never throw an exception here.
        $names = $user->getAllPermissions()->pluck('name');

        return $names->contains('appearance.manage') || $names->contains('settings.manage');
    }
}

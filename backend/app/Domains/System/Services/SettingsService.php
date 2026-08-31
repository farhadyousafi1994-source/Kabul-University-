<?php

namespace App\Domains\System\Services;

use App\Domains\System\Models\Setting;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    public const CACHE_KEY = 'ku_ams_settings';

    /**
     * Get a setting value (cached), falling back to the documented default.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $all = self::all();

        return $all[$key] ?? $default;
    }

    public static function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $rows = Setting::all(['key', 'value', 'type']);
            $out = [];

            foreach ($rows as $row) {
                $out[$row->key] = match ($row->type) {
                    Setting::TYPE_NUMBER => (int) $row->value,
                    Setting::TYPE_BOOLEAN => filter_var($row->value, FILTER_VALIDATE_BOOL),
                    Setting::TYPE_JSON => json_decode((string) $row->value, true),
                    default => $row->value,
                };
            }

            return $out;
        });
    }

    /**
     * Upsert a batch of settings and flush the cache.
     */
    public static function set(array $settings): void
    {
        foreach ($settings as $key => $value) {
            if (! array_key_exists($key, Setting::DEFAULTS) && ! Setting::where('key', $key)->exists()) {
                continue; // only allow keys we know about (or existing rows)
            }

            $default = Setting::DEFAULTS[$key] ?? [null, 'general', Setting::TYPE_STRING];
            [$defaultValue, $group, $type] = $default;

            $stored = is_bool($value) ? ($value ? '1' : '0') : (is_array($value) ? json_encode($value) : (string) $value);

            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $stored, 'group' => $group, 'type' => $type],
            );
        }

        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Seed defaults (called from DatabaseSeeder).
     */
    public static function seedDefaults(): void
    {
        foreach (Setting::DEFAULTS as $key => [$value, $group, $type]) {
            Setting::firstOrCreate(
                ['key' => $key],
                ['value' => $value, 'group' => $group, 'type' => $type],
            );
        }
    }
}

<?php

namespace App\Domains\System\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Organisation-wide default appearance + branding (Module 24b).
 *
 * A singleton: exactly one row ever exists (id = 1), created by the migration.
 * Editable only by users holding the `appearance.manage` permission — see
 * AppearanceController.
 */
class AppearanceDefault extends Model
{
    public const SINGLETON_ID = 1;

    /**
     * @var list<string>
     */
    public const BRAND_FIELDS = ['organization_name', 'brand_name', 'logo_url', 'favicon_url'];

    public $incrementing = false;

    /**
     * `id` is fillable on purpose: the singleton row is addressed by a fixed
     * primary key rather than an auto-incrementing one. Written out rather
     * than spread from the shared constants — property defaults must be
     * constant expressions.
     *
     * @var list<string>
     */
    protected $fillable = [
        'id',
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
        'organization_name',
        'brand_name',
        'logo_url',
        'favicon_url',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'custom_colors' => 'array',
        'layout_preferences' => 'array',
        'accessibility_preferences' => 'array',
        'animations_enabled' => 'boolean',
        'font_weight' => 'integer',
        'line_height' => 'float',
    ];

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Fetch the singleton row, re-creating it if it has somehow gone missing.
     */
    public static function instance(): self
    {
        return static::query()->firstOrCreate(
            ['id' => self::SINGLETON_ID],
            [
                'theme_mode' => 'system',
                'selected_theme' => 'softcora',
                'font_family' => 'roboto',
                'font_size' => 'M',
                'font_weight' => 400,
                'line_height' => 1.50,
                'border_radius' => 'normal',
                'sidebar_style' => 'normal',
                'table_density' => 'compact',
                'animations_enabled' => true,
                'calendar_type' => 'gregorian',
                'layout_preferences' => ['header' => 'fixed', 'contentWidth' => 'boxed', 'dashboardDensity' => 'comfortable'],
                'accessibility_preferences' => ['highContrast' => false, 'reducedMotion' => false, 'largerText' => false, 'strongFocus' => false, 'keyboardNav' => true],
                'organization_name' => 'Kabul University',
                'brand_name' => 'SoftCora Technologies',
            ],
        );
    }
}

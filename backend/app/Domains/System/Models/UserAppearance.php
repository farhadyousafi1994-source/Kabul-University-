<?php

namespace App\Domains\System\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single user's saved Theme & Appearance preferences (Module 24b).
 *
 * `user_appearances.user_id` IS the primary key — every user has at most one
 * appearance row, and it disappears together with the account.
 */
class UserAppearance extends Model
{
    /**
     * The preference columns shared with `appearance_defaults`, declared once
     * so the migration, the form requests, the service and the frontend
     * contract can never drift apart.
     *
     * @var list<string>
     */
    public const FIELDS = [
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
    ];

    public $incrementing = false;

    protected $primaryKey = 'user_id';

    /**
     * Written out rather than spread from FIELDS: property defaults must be
     * constant expressions, and `...self::FIELDS` is not one.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

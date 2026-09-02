<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Module 24b — Theme & Appearance persistence.
 *
 *   `user_appearances`   one row per user (unique on user_id) holding that
 *                        user's own saved appearance. This is the primary
 *                        persistence layer; the SPA keeps a read-through cache
 *                        in localStorage only so the right theme paints before
 *                        the first API response arrives.
 *   `appearance_defaults` a single row (id = 1) with the organisation-wide
 *                        default appearance + branding, editable only by users
 *                        holding `appearance.manage`.
 *
 * Mirrors frontend/mock-api/db.js and the AppearanceController contract 1:1.
 * Non-destructive and fully reversible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_appearances', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained('users')->cascadeOnDelete();

            $table->string('theme_mode', 16)->default('system');          // light | dark | system
            $table->string('selected_theme', 64)->default('softcora');    // THEME_SCHEMES id
            $table->json('custom_colors')->nullable();                    // token => #hex | null

            $table->string('font_family', 64)->default('roboto');         // FONT_FAMILIES id
            $table->string('font_size', 8)->default('M');                 // S | M | L | XL
            $table->unsignedSmallInteger('font_weight')->default(400);    // 300 … 800
            $table->decimal('line_height', 3, 2)->default(1.50);          // 1.00 … 2.50

            $table->string('border_radius', 16)->default('normal');       // sharp | normal | round
            $table->string('sidebar_style', 16)->default('normal');       // mini | normal | expanded | floating
            $table->string('table_density', 16)->default('compact');      // compact | comfortable | spacious
            $table->boolean('animations_enabled')->default(true);
            $table->string('calendar_type', 16)->default('gregorian');    // gregorian | solar

            $table->json('layout_preferences')->nullable();               // header | contentWidth | dashboardDensity
            $table->json('accessibility_preferences')->nullable();        // highContrast | reducedMotion | …

            $table->timestamps();
        });

        Schema::create('appearance_defaults', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->string('theme_mode', 16)->default('system');
            $table->string('selected_theme', 64)->default('softcora');
            $table->json('custom_colors')->nullable();
            $table->string('font_family', 64)->default('roboto');
            $table->string('font_size', 8)->default('M');
            $table->unsignedSmallInteger('font_weight')->default(400);
            $table->decimal('line_height', 3, 2)->default(1.50);
            $table->string('border_radius', 16)->default('normal');
            $table->string('sidebar_style', 16)->default('normal');
            $table->string('table_density', 16)->default('compact');
            $table->boolean('animations_enabled')->default(true);
            $table->string('calendar_type', 16)->default('gregorian');
            $table->json('layout_preferences')->nullable();
            $table->json('accessibility_preferences')->nullable();

            // Branding shown in the live preview and across the shell.
            $table->string('organization_name')->nullable();
            $table->string('brand_name')->nullable();
            $table->string('logo_url')->nullable();
            $table->string('favicon_url')->nullable();

            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('appearance_defaults')->insert([
            'id' => 1,
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
            'layout_preferences' => json_encode(['header' => 'fixed', 'contentWidth' => 'boxed', 'dashboardDensity' => 'comfortable']),
            'accessibility_preferences' => json_encode(['highContrast' => false, 'reducedMotion' => false, 'largerText' => false, 'strongFocus' => false, 'keyboardNav' => true]),
            'organization_name' => 'Kabul University',
            'brand_name' => 'SoftCora Technologies',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('appearance_defaults');
        Schema::dropIfExists('user_appearances');
    }
};

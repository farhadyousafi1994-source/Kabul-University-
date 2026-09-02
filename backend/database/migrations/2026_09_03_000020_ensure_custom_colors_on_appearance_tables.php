<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ensure `custom_colors` exists on both appearance tables.
 *
 * `2026_09_03_000010_create_appearance_tables` already creates the column on
 * a fresh install. This follow-up is hasColumn-safe so databases that
 * received an earlier revision of that migration (or a hand-rolled table)
 * still pick up the column without a destructive rebuild.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['user_appearances', 'appearance_defaults'] as $tableName) {
            if (! Schema::hasTable($tableName) || Schema::hasColumn($tableName, 'custom_colors')) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) {
                $table->json('custom_colors')->nullable()->after('selected_theme');
            });
        }
    }

    public function down(): void
    {
        foreach (['user_appearances', 'appearance_defaults'] as $tableName) {
            if (! Schema::hasTable($tableName) || ! Schema::hasColumn($tableName, 'custom_colors')) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('custom_colors');
            });
        }
    }
};

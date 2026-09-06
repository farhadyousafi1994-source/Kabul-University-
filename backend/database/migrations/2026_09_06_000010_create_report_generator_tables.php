<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 23b — Advanced Report Generator persistence.
 *
 *   `saved_reports`     a named Report Query Object (already normalised and
 *                       validated against the catalog) plus the question that
 *                       produced it, its chart type and its sharing flag.
 *   `report_schedules`  automatic delivery of a saved report by notification,
 *                       email or download centre.
 *
 * Mirrors frontend/mock-api/db.js one-to-one. Non-destructive and reversible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_reports', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('description', 500)->nullable();
            // The natural-language question, kept so the report can be shown,
            // edited and re-asked in the language it was written in.
            $table->string('question', 500)->nullable();
            $table->string('module', 64);
            // The NORMALISED query object — re-validated on every run.
            $table->json('query');
            $table->string('chart_type', 16)->default('auto');
            $table->string('locale', 8)->nullable();
            $table->boolean('is_shared')->default(false);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('last_run_at')->nullable();
            $table->unsignedInteger('run_count')->default(0);
            $table->timestamps();

            $table->index(['created_by', 'updated_at']);
            $table->index('is_shared');
        });

        Schema::create('report_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('saved_report_id')->constrained('saved_reports')->cascadeOnDelete();
            $table->string('frequency', 16);              // daily | weekly | monthly | quarterly
            $table->unsignedTinyInteger('day_of_week')->nullable();   // 0 (Sunday) … 6
            $table->unsignedTinyInteger('day_of_month')->nullable();  // 1 … 28
            $table->string('time_of_day', 5)->default('08:00');
            $table->string('delivery', 16)->default('notification');  // notification | email | download
            $table->string('recipients', 500)->nullable();
            $table->string('format', 8)->default('pdf');  // pdf | excel | csv
            $table->boolean('active')->default(true);
            $table->timestamp('next_run_at')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['active', 'next_run_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_schedules');
        Schema::dropIfExists('saved_reports');
    }
};

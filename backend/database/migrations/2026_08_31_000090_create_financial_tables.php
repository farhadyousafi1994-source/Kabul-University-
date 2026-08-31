<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 18 — Depreciation + Module 19 — Disposal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('depreciation_methods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 24)->unique();
            $table->string('name');
            $table->string('formula')->nullable();
            $table->decimal('rate', 6, 4)->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        Schema::create('asset_depreciations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('method_id')->constrained('depreciation_methods')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('period', 7)->index(); // YYYY-MM
            $table->decimal('original_value', 14, 2);
            $table->decimal('salvage_value', 14, 2)->default(0);
            $table->unsignedInteger('useful_life')->default(5);
            $table->decimal('annual_depreciation', 14, 2)->default(0);
            $table->decimal('accumulated_depreciation', 14, 2)->default(0);
            $table->decimal('book_value', 14, 2)->default(0);
            $table->timestamps();

            $table->unique(['asset_id', 'period']);
            $table->index('period');
        });

        Schema::create('asset_disposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('method', 24)->default('sold')->index();
            $table->foreignId('requested_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->date('request_date')->nullable();
            $table->date('approval_date')->nullable();
            $table->date('disposal_date')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->decimal('revenue', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_disposals');
        Schema::dropIfExists('asset_depreciations');
        Schema::dropIfExists('depreciation_methods');
    }
};

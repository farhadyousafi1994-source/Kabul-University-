<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 14 — Asset audit & verification.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_audits', function (Blueprint $table) {
            $table->id();
            $table->string('audit_code', 32)->unique();
            $table->foreignId('auditor_id')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->string('scope_type', 32)->nullable(); // campus|faculty|department|building|floor|room|warehouse
            $table->unsignedBigInteger('scope_id')->nullable();
            $table->date('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->text('summary')->nullable();
            $table->timestamps();
        });

        Schema::create('asset_audit_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_audit_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->cascadeOnDelete();
            $table->timestamp('scanned_at')->nullable();
            $table->string('verification', 24)->nullable()->index(); // verified|missing|wrong_location|damaged
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['asset_audit_id', 'asset_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_audit_items');
        Schema::dropIfExists('asset_audits');
    }
};

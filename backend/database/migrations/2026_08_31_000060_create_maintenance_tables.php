<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 11 — Maintenance management + Module 12 — incidents.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('maintenance_type', 24)->default('corrective')->index();
            $table->string('priority', 16)->default('medium')->index();
            $table->text('problem');
            $table->string('status', 24)->default('requested')->index();
            $table->timestamps();
        });

        Schema::create('asset_maintenances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_request_id')->nullable()->constrained()->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('technician_id')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->string('maintenance_type', 24)->default('corrective')->index();
            $table->date('scheduled_date')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->decimal('cost', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->text('result')->nullable();
            $table->string('status', 24)->default('requested')->index();
            $table->timestamps();

            $table->index(['asset_id', 'status']);
        });

        Schema::create('asset_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('incident_type', 24)->index();
            $table->text('description');
            $table->date('incident_date');
            $table->foreignId('reported_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->string('status', 24)->default('open')->index();
            $table->text('resolution')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_incidents');
        Schema::dropIfExists('asset_maintenances');
        Schema::dropIfExists('maintenance_requests');
    }
};

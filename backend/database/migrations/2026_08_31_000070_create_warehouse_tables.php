<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 17 — Warehouses & warehouse transactions.
 * Shipped before procurement because purchase_receipts reference warehouses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 24)->unique();
            $table->string('name');
            $table->string('location')->nullable();
            $table->foreignId('keeper_id')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('warehouse_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('type', 16)->index(); // IN | OUT | TRANSFER | ADJUSTMENT
            $table->unsignedInteger('quantity')->default(1);
            $table->string('reference_type', 40)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['warehouse_id', 'type']);
            $table->index('asset_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_transactions');
        Schema::dropIfExists('warehouses');
    }
};

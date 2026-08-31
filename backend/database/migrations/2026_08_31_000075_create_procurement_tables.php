<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 16 — Procurement: purchase requests, purchase orders, receipts.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_requests', function (Blueprint $table) {
            $table->id();
            $table->string('pr_number', 32)->unique();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->cascadeOnUpdate()->nullOnDelete();
            $table->string('status', 24)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number', 32)->unique();
            $table->foreignId('purchase_request_id')->nullable()->constrained()->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('status', 24)->default('draft')->index();
            $table->date('order_date')->nullable();
            $table->date('expected_date')->nullable();
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('tax', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('asset_category_id')->nullable()->constrained()->cascadeOnUpdate()->nullOnDelete();
            $table->string('name');
            $table->string('brand', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 14, 2)->default(0);
            $table->unsignedInteger('received_quantity')->default(0);
            $table->timestamps();
        });

        Schema::create('purchase_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number', 32)->unique();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->date('received_date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_receipts');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('purchase_requests');
    }
};

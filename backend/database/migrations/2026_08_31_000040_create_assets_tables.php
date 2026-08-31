<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 6 — Assets (core) + Module 7 — images & documents.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_code', 40)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('category_id')->constrained('asset_categories')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('subcategory_id')->nullable()->constrained('asset_subcategories')->cascadeOnUpdate()->nullOnDelete();
            $table->string('brand', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->string('serial_number', 100)->nullable()->unique();
            $table->string('barcode', 64)->nullable()->unique();
            $table->string('qr_code', 64)->nullable()->unique();
            $table->date('purchase_date')->nullable();
            $table->decimal('purchase_price', 14, 2)->default(0);
            $table->decimal('current_value', 14, 2)->default(0);
            $table->decimal('salvage_value', 14, 2)->default(0);
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->cascadeOnUpdate()->nullOnDelete();
            $table->date('warranty_expiry_date')->nullable();
            $table->unsignedInteger('useful_life')->default(5);
            $table->string('status', 24)->default('available')->index();
            $table->string('condition', 24)->default('good')->index();
            // Location (physical)
            $table->foreignId('campus_id')->nullable()->constrained('campuses')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('faculty_id')->nullable()->constrained('faculties')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('building_id')->nullable()->constrained('buildings')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('floor_id')->nullable()->constrained('floors')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('room_id')->nullable()->constrained('rooms')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category_id', 'status']);
            $table->index('name');
        });

        Schema::create('asset_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('filename');
            $table->string('path');
            $table->string('mime', 100)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('asset_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('kind', 24)->default('other')->index();
            $table->string('filename');
            $table->string('path');
            $table->string('mime', 100)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_documents');
        Schema::dropIfExists('asset_images');
        Schema::dropIfExists('assets');
    }
};

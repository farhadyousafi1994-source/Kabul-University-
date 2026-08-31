<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 8 — Assignments & returns; Module 9 — transfers & location history;
 * Module 10 — asset requests.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('assigned_to_user_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('assigned_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->date('assigned_date');
            $table->date('expected_return_date')->nullable();
            $table->date('returned_date')->nullable();
            $table->string('condition_on_return', 24)->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'status']);
            $table->index('assigned_to_user_id');
        });

        Schema::create('asset_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            // From location
            $table->foreignId('from_campus_id')->nullable()->constrained('campuses')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('from_faculty_id')->nullable()->constrained('faculties')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('from_department_id')->nullable()->constrained('departments')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('from_building_id')->nullable()->constrained('buildings')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('from_floor_id')->nullable()->constrained('floors')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('from_room_id')->nullable()->constrained('rooms')->cascadeOnUpdate()->nullOnDelete();
            // To location
            $table->foreignId('to_campus_id')->nullable()->constrained('campuses')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('to_faculty_id')->nullable()->constrained('faculties')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('to_department_id')->nullable()->constrained('departments')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('to_building_id')->nullable()->constrained('buildings')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('to_floor_id')->nullable()->constrained('floors')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('to_room_id')->nullable()->constrained('rooms')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->date('transfer_date')->nullable();
            $table->string('status', 20)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('asset_id');
        });

        Schema::create('asset_location_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('campus_id')->nullable()->constrained('campuses')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('faculty_id')->nullable()->constrained('faculties')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('building_id')->nullable()->constrained('buildings')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('floor_id')->nullable()->constrained('floors')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('room_id')->nullable()->constrained('rooms')->cascadeOnUpdate()->nullOnDelete();
            $table->foreignId('moved_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->timestamp('moved_at')->nullable();
            $table->string('reason', 100)->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'moved_at']);
        });

        Schema::create('asset_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_number', 32)->unique();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnUpdate()->nullOnDelete();
            $table->string('request_type', 24)->default('new_asset')->index();
            $table->foreignId('asset_category_id')->nullable()->constrained('asset_categories')->cascadeOnUpdate()->nullOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->text('reason')->nullable();
            $table->string('status', 32)->default('draft')->index();
            $table->timestamps();

            $table->index('requester_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_requests');
        Schema::dropIfExists('asset_location_histories');
        Schema::dropIfExists('asset_transfers');
        Schema::dropIfExists('asset_assignments');
    }
};

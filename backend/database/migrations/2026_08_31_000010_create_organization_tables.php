<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * University organization structure (Module 4 schema — shipped as part of
 * the database foundation because users.department_id references it).
 *
 * Hierarchy: campuses → faculties → departments
 *            campuses → buildings → floors → rooms
 *
 * Deletion policy: parent records are RESTRICTED from deletion while
 * children exist; children are RESTRICTED while assets reference them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campuses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('address')->nullable();
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('faculties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('dean')->nullable();
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('campus_id');
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faculty_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('head')->nullable();
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('faculty_id');
        });

        Schema::create('buildings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('campus_id');
        });

        Schema::create('floors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('building_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->unsignedTinyInteger('level')->default(1);
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('building_id');
        });

        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('floor_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('room_type', 24)->default('general')->index();
            $table->unsignedInteger('capacity')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('floor_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('floors');
        Schema::dropIfExists('buildings');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('faculties');
        Schema::dropIfExists('campuses');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the skeleton users table with the KU-AMS user profile fields.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->unique()->nullable()->after('name');
            $table->string('phone', 32)->nullable()->after('email');
            $table->string('employee_number', 32)->unique()->nullable()->after('phone');
            $table->foreignId('department_id')
                ->nullable()
                ->after('employee_number')
                ->constrained('departments')
                ->cascadeOnUpdate()
                ->nullOnDelete();
            $table->string('status', 20)->default('active')->index()->after('department_id');
            $table->string('avatar')->nullable()->after('status');
            $table->softDeletes()->after('updated_at');

            $table->index('department_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('department_id');
            $table->dropUnique(['username']);
            $table->dropUnique(['employee_number']);
            $table->dropColumn(['username', 'phone', 'employee_number', 'status', 'avatar', 'deleted_at']);
        });
    }
};

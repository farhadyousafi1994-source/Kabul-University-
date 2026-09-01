<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the HR / employee fields used by the Employees module:
 * position, hire type (permanent/contract) and monthly salary.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('position')->nullable()->after('department_id');
            $table->string('hire_type', 20)->default('permanent')->after('position');
            $table->unsignedInteger('salary')->default(0)->after('hire_type');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['position', 'hire_type', 'salary']);
        });
    }
};

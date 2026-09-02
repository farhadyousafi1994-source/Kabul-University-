<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The `users` table becomes a pure authentication/accounts table:
 *
 *   id, name, username, email, phone, department_id, status, avatar,
 *   password, roles/permissions, timestamps…
 *
 * All employee/HR data (employee_number, position, hire_type, salary) now
 * lives exclusively in the dedicated `employees` table, which is the single
 * source of truth for staff records. Before anything is dropped, every user
 * row is guaranteed to have a linked employee profile:
 *
 *   1. `2026_09_02_000010_create_employees_table` copied all staff records
 *      from `users` into `employees` (users kept untouched, linked via
 *      `employees.user_id`).
 *   2. `2026_09_02_000020_add_employee_id_to_asset_assignments_table` ran the
 *      same migration defensively for any row created in between.
 *
 * An employee who needs a login keeps the optional `employees.user_id` link
 * (Employee belongsTo User / User hasOne Employee) — employee data is never
 * duplicated inside `users` again.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['employee_number']);
            $table->dropColumn(['employee_number', 'position', 'hire_type', 'salary']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('employee_number', 32)->nullable()->unique()->after('phone');
            $table->string('position')->nullable()->after('department_id');
            $table->string('hire_type', 20)->default('permanent')->after('position');
            $table->unsignedInteger('salary')->default(0)->after('hire_type');
        });
    }
};

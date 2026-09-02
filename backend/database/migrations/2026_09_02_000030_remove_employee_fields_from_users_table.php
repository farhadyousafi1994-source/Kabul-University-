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
 *
 * Safe to re-run: every drop is gated on Schema::hasColumn / hasIndex.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $drop = array_values(array_filter(
            ['employee_number', 'position', 'hire_type', 'salary'],
            fn (string $column) => Schema::hasColumn('users', $column),
        ));

        if ($drop === []) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($drop) {
            if (in_array('employee_number', $drop, true)) {
                try {
                    if (Schema::hasIndex('users', 'users_employee_number_unique')) {
                        $table->dropUnique(['employee_number']);
                    }
                } catch (\Throwable) {
                    // Unique index may already have been dropped.
                }
            }

            $table->dropColumn($drop);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'employee_number')) {
                $table->string('employee_number', 32)->nullable()->unique()->after('phone');
            }
            if (! Schema::hasColumn('users', 'position')) {
                $table->string('position')->nullable();
            }
            if (! Schema::hasColumn('users', 'hire_type')) {
                $table->string('hire_type', 20)->default('permanent');
            }
            if (! Schema::hasColumn('users', 'salary')) {
                $table->unsignedInteger('salary')->default(0);
            }
        });
    }
};

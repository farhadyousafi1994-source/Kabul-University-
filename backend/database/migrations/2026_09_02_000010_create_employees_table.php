<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Employees module — dedicated `employees` table, fully separated from the
 * authentication `users` table, plus the direct Asset → Employee assignment
 * relation (`assets.employee_id`).
 *
 * Data safety:
 *  - existing staff data previously stored on `users` is COPIED into
 *    `employees` (linked back through `employees.user_id`); user records and
 *    authentication are never modified or deleted;
 *  - active hand-out assignments are mirrored onto `assets.employee_id` so
 *    the "who holds what" relation is populated from day one;
 *  - the migration is non-destructive and fully reversible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_code', 50)->unique();
            $table->string('first_name', 100);
            $table->string('last_name', 100)->default('');
            $table->string('email')->nullable()->unique();
            $table->string('phone', 50)->nullable();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('position')->nullable();
            $table->string('job_title')->nullable();
            $table->string('employment_type', 20)->default('full_time'); // full_time | part_time | contract
            $table->string('status', 20)->default('active');             // active | inactive | on_leave
            $table->date('hire_date')->nullable();
            $table->foreignId('manager_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('address')->nullable();
            $table->text('notes')->nullable();
            // Optional link to a login account — an employee is NOT a user.
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['department_id', 'status']);
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->foreignId('employee_id')
                ->nullable()
                ->after('room_id')
                ->constrained('employees')
                ->nullOnDelete();
            $table->index('employee_id');
        });

        $this->migrateEmployeesFromUsers();
        $this->linkAssetsFromActiveAssignments();
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('employee_id');
        });

        Schema::dropIfExists('employees');
    }

    /**
     * Copy staff records that live on the users table into employees.
     * Users keep their rows untouched — this only creates linked profiles.
     */
    private function migrateEmployeesFromUsers(): void
    {
        $now = now();

        foreach (DB::table('users')->whereNull('deleted_at')->orderBy('id')->get() as $user) {
            $nameParts = preg_split('/\s+/', trim((string) $user->name)) ?: [];
            $firstName = array_shift($nameParts) ?? '';
            $lastName = implode(' ', $nameParts);

            DB::table('employees')->insert([
                'employee_code' => $user->employee_number ?: sprintf('EMP-%04d', $user->id),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $user->email,
                'phone' => $user->phone ?? null,
                'department_id' => $user->department_id ?? null,
                'position' => $user->position ?? null,
                'job_title' => $user->position ?? null,
                'employment_type' => ($user->hire_type ?? null) === 'contract' ? 'contract' : 'full_time',
                'status' => match ($user->status ?? 'active') {
                    'leave' => 'on_leave',
                    'inactive', 'deactivated' => 'inactive',
                    default => 'active',
                },
                'hire_date' => $user->created_at ? substr((string) $user->created_at, 0, 10) : null,
                'user_id' => $user->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Populate assets.employee_id from currently active assignments so the
     * new relation reflects reality immediately after the upgrade.
     */
    private function linkAssetsFromActiveAssignments(): void
    {
        if (! Schema::hasTable('asset_assignments')) {
            return;
        }

        $active = DB::table('asset_assignments')->where('status', 'active')->get();

        foreach ($active as $assignment) {
            $employeeId = DB::table('employees')
                ->where('user_id', $assignment->assigned_to_user_id)
                ->value('id');

            if ($employeeId) {
                DB::table('assets')
                    ->where('id', $assignment->asset_id)
                    ->whereNull('employee_id')
                    ->update(['employee_id' => $employeeId]);
            }
        }
    }
};

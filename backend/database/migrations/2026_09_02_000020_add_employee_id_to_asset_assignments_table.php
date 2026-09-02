<?php

use App\Domains\HR\Models\Employee;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Asset assignments record the EMPLOYEE who receives the asset.
 *
 * `asset_assignments.employee_id` → `employees.id` becomes the authoritative
 * assignee reference. `assigned_to_user_id` stays only as a legacy mirror of
 * the employee's linked login account (when one exists) for historical rows;
 * employees without a login account can now receive hand-out assignments.
 *
 * Data safety: existing assignments are backfilled with the employee that is
 * linked to the previously recorded user account. No rows are deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->foreignId('employee_id')
                ->nullable()
                ->after('asset_id')
                ->constrained('employees')
                ->cascadeOnUpdate()
                ->nullOnDelete();
            $table->index('employee_id');
        });

        // Make the legacy user reference optional (employees do not need a
        // login account to receive assets).
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->unsignedBigInteger('assigned_to_user_id')->nullable()->change();
        });

        // Backfill: resolve the employee through the user account link.
        DB::table('asset_assignments')
            ->whereNull('employee_id')
            ->whereNotNull('assigned_to_user_id')
            ->orderBy('id')
            ->chunkById(200, function ($assignments): void {
                foreach ($assignments as $assignment) {
                    $employeeId = DB::table('employees')
                        ->where('user_id', $assignment->assigned_to_user_id)
                        ->value('id');

                    if ($employeeId) {
                        DB::table('asset_assignments')
                            ->where('id', $assignment->id)
                            ->update(['employee_id' => $employeeId]);
                    }
                }
            });

        // Historical mirror: record the employee's linked user (if any) so old
        // tooling reading assigned_to_user_id keeps working.
        DB::table('asset_assignments')
            ->whereNull('assigned_to_user_id')
            ->whereNotNull('employee_id')
            ->orderBy('id')
            ->chunkById(200, function ($assignments): void {
                foreach ($assignments as $assignment) {
                    $userId = DB::table('employees')->where('id', $assignment->employee_id)->value('user_id');
                    DB::table('asset_assignments')
                        ->where('id', $assignment->id)
                        ->update(['assigned_to_user_id' => $userId]);
                }
            });

        // Safety net (defensive): migrate any user that still carries employee
        // data but has no employee profile yet. Runs before the companion
        // migration removes the employee columns from `users`.
        $this->migrateRemainingUsers();
    }

    public function down(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('employee_id');
        });

        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->dropIndex(['employee_id']);
        });
    }

    /**
     * Ensure every non-deleted user has an employee profile before the users
     * table loses its employee columns (preserving every staff record).
     */
    private function migrateRemainingUsers(): void
    {
        $now = now();

        foreach (DB::table('users')->whereNull('deleted_at')->orderBy('id')->get() as $user) {
            $exists = DB::table('employees')->where('user_id', $user->id)->exists();
            if ($exists) {
                continue;
            }

            $nameParts = preg_split('/\s+/', trim((string) $user->name)) ?: [];
            $firstName = array_shift($nameParts) ?? '';
            $lastName = implode(' ', $nameParts);

            DB::table('employees')->insert([
                'employee_code' => Employee::nextCode(),
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
};

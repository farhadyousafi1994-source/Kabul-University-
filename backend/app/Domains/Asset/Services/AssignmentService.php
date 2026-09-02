<?php

namespace App\Domains\Asset\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetAssignment;
use App\Domains\HR\Models\Employee;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 8 — Assignment & return lifecycle.
 *
 * Assets are handed out to EMPLOYEES (the dedicated `employees` table):
 *
 *   employees table → Assign To (employee_id) → asset_assignments.employee_id
 *                   → mirrored onto assets.employee_id
 */
class AssignmentService
{
    /**
     * Assign an asset to an employee.
     *
     * @param  array{employee_id?: int|null, expected_return_date?: string|null, notes?: string|null}  $data
     *
     * @throws ValidationException
     */
    public static function assign(Asset $asset, array $data, ?int $assignedBy = null): AssetAssignment
    {
        $employee = self::resolveEmployee($data);

        if ($asset->status === Asset::STATUS_DISPOSED || $asset->status === Asset::STATUS_RETIRED) {
            throw ValidationException::withMessages([
                'asset_id' => ['This asset cannot be assigned (disposed/retired).'],
            ]);
        }

        if (self::hasActiveAssignment($asset)) {
            throw ValidationException::withMessages([
                'asset_id' => ['This asset already has an active assignment.'],
            ]);
        }

        return DB::transaction(function () use ($asset, $data, $assignedBy, $employee) {
            $assignedBy ??= auth('sanctum')->id();

            $assignment = AssetAssignment::create([
                'asset_id' => $asset->id,
                'employee_id' => $employee->id,
                // Historical mirror of the employee's linked login account.
                'assigned_to_user_id' => $employee->user_id,
                'assigned_by' => $assignedBy,
                'assigned_date' => now()->toDateString(),
                'expected_return_date' => $data['expected_return_date'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => AssetAssignment::STATUS_ACTIVE,
            ]);

            // Business rules: assigned asset status flips automatically and
            // the employee relation on the asset is kept in sync.
            $asset->update([
                'status' => Asset::STATUS_ASSIGNED,
                'employee_id' => $employee->id,
            ]);

            ActivityLogService::record('assigned', 'Assignments', Asset::class, $asset->id, $asset->name, null, [
                'employee_id' => $employee->id,
                'employee_name' => $employee->full_name,
            ], $assignedBy);

            if ($employee->user_id) {
                NotificationService::send(
                    (int) $employee->user_id,
                    'asset_assigned',
                    'Asset assigned to you',
                    "{$asset->name} ({$asset->asset_code}) has been assigned to you.",
                    'assignment_ind',
                );
            }

            return $assignment;
        });
    }

    /**
     * Return an asset: closes the active assignment, records condition and
     * notes, restores the asset status and unassigns the employee.
     *
     * @param  array{condition_on_return: string, notes?: string|null, returned_date?: string|null}  $data
     */
    public static function returnAsset(AssetAssignment $assignment, array $data): AssetAssignment
    {
        if ($assignment->status !== AssetAssignment::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'assignment' => ['This assignment is already closed.'],
            ]);
        }

        return DB::transaction(function () use ($assignment, $data) {
            $assignment->update([
                'status' => AssetAssignment::STATUS_RETURNED,
                'returned_date' => $data['returned_date'] ?? now()->toDateString(),
                'condition_on_return' => $data['condition_on_return'],
                'notes' => isset($data['notes']) ? ($assignment->notes ? $assignment->notes."\n".$data['notes'] : $data['notes']) : $assignment->notes,
            ]);

            $asset = $assignment->asset;

            // Return condition feeds the asset's condition field; status
            // becomes available again and the employee is unassigned (the
            // assignment history keeps the full record).
            $asset->update([
                'condition' => $data['condition_on_return'],
                'status' => Asset::STATUS_AVAILABLE,
                'employee_id' => null,
            ]);

            ActivityLogService::record('returned', 'Assignments', Asset::class, $asset->id, $asset->name, null, [
                'condition_on_return' => $data['condition_on_return'],
            ]);

            if ($assignment->employee?->user_id) {
                NotificationService::send(
                    (int) $assignment->employee->user_id,
                    'asset_returned',
                    'Asset return recorded',
                    "{$asset->name} ({$asset->asset_code}) was returned in {$data['condition_on_return']} condition.",
                    'assignment_return',
                );
            }

            return $assignment->fresh();
        });
    }

    public static function hasActiveAssignment(Asset $asset): bool
    {
        return $asset->assignments()->where('status', AssetAssignment::STATUS_ACTIVE)->exists();
    }

    /**
     * Mark overdue assignments (expected return date passed). Called by the
     * scheduler and lazily from the list endpoint.
     */
    public static function markOverdue(): int
    {
        return AssetAssignment::where('status', AssetAssignment::STATUS_ACTIVE)
            ->whereNotNull('expected_return_date')
            ->where('expected_return_date', '<', now()->toDateString())
            ->update(['status' => AssetAssignment::STATUS_OVERDUE]);
    }

    /**
     * Resolve the assignee employee from `employee_id` only.
     * `assigned_to_user_id` is never an assignment input.
     *
     * @param  array{employee_id?: int|null}  $data
     *
     * @throws ValidationException
     */
    public static function resolveEmployee(array $data): Employee
    {
        $employee = ! empty($data['employee_id'])
            ? Employee::find((int) $data['employee_id'])
            : null;

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee_id' => ['The selected employee does not exist.'],
            ]);
        }

        return $employee;
    }
}

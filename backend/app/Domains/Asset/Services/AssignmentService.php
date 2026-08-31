<?php

namespace App\Domains\Asset\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetAssignment;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 8 — Assignment & return lifecycle.
 */
class AssignmentService
{
    /**
     * Assign an asset to a user.
     *
     * @param  array{assigned_to_user_id: int, expected_return_date?: string|null, notes?: string|null}  $data
     *
     * @throws ValidationException
     */
    public static function assign(Asset $asset, array $data, ?int $assignedBy = null): AssetAssignment
    {
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

        return DB::transaction(function () use ($asset, $data, $assignedBy) {
            $assignedBy ??= auth('sanctum')->id();

            $assignment = AssetAssignment::create([
                'asset_id' => $asset->id,
                'assigned_to_user_id' => $data['assigned_to_user_id'],
                'assigned_by' => $assignedBy,
                'assigned_date' => now()->toDateString(),
                'expected_return_date' => $data['expected_return_date'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => AssetAssignment::STATUS_ACTIVE,
            ]);

            // Business rule: assigned asset status flips automatically.
            $asset->update(['status' => Asset::STATUS_ASSIGNED]);

            ActivityLogService::record('assigned', 'Assignments', Asset::class, $asset->id, $asset->name, null, [
                'assigned_to_user_id' => $data['assigned_to_user_id'],
            ], $assignedBy);

            NotificationService::send(
                (int) $data['assigned_to_user_id'],
                'asset_assigned',
                'Asset assigned to you',
                "{$asset->name} ({$asset->asset_code}) has been assigned to you.",
                'assignment_ind',
            );

            return $assignment;
        });
    }

    /**
     * Return an asset: closes the active assignment, records condition and
     * notes, restores the asset status.
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
            // becomes available again (maintenance/incident flows may change it).
            $asset->update([
                'condition' => $data['condition_on_return'],
                'status' => Asset::STATUS_AVAILABLE,
            ]);

            ActivityLogService::record('returned', 'Assignments', Asset::class, $asset->id, $asset->name, null, [
                'condition_on_return' => $data['condition_on_return'],
            ]);

            NotificationService::send(
                $assignment->assigned_to_user_id,
                'asset_returned',
                'Asset return recorded',
                "{$asset->name} ({$asset->asset_code}) was returned in {$data['condition_on_return']} condition.",
                'assignment_return',
            );

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
}

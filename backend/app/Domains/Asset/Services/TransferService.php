<?php

namespace App\Domains\Asset\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetTransfer;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 9 — Transfer workflow & location history.
 *
 * Draft → Requested → Approved → In Transit → Completed / Rejected.
 * Historical locations are never overwritten: completion records a new
 * location-history row and updates the asset's current location.
 */
class TransferService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public static function create(Asset $asset, array $data): AssetTransfer
    {
        $transfer = AssetTransfer::create([
            'asset_id' => $asset->id,
            'from_campus_id' => $data['from_campus_id'] ?? $asset->campus_id,
            'from_faculty_id' => $data['from_faculty_id'] ?? $asset->faculty_id,
            'from_department_id' => $data['from_department_id'] ?? $asset->department_id,
            'from_building_id' => $data['from_building_id'] ?? $asset->building_id,
            'from_floor_id' => $data['from_floor_id'] ?? $asset->floor_id,
            'from_room_id' => $data['from_room_id'] ?? $asset->room_id,
            'to_campus_id' => $data['to_campus_id'] ?? null,
            'to_faculty_id' => $data['to_faculty_id'] ?? null,
            'to_department_id' => $data['to_department_id'] ?? null,
            'to_building_id' => $data['to_building_id'] ?? null,
            'to_floor_id' => $data['to_floor_id'] ?? null,
            'to_room_id' => $data['to_room_id'] ?? null,
            'requested_by' => $data['requested_by'] ?? auth('sanctum')->id(),
            'transfer_date' => $data['transfer_date'] ?? null,
            'status' => $data['status'] ?? AssetTransfer::STATUS_REQUESTED,
            'notes' => $data['notes'] ?? null,
        ]);

        ActivityLogService::record('transferred', 'Transfers', AssetTransfer::class, $transfer->id, $asset->name, null, $data);

        return $transfer;
    }

    /**
     * Advance or reject the workflow. Only valid transitions are allowed.
     */
    public static function transition(AssetTransfer $transfer, string $newStatus, ?int $approverId = null): AssetTransfer
    {
        $allowed = self::allowedTransitions($transfer->status);

        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Invalid transition from '{$transfer->status}' to '{$newStatus}'."],
            ]);
        }

        return DB::transaction(function () use ($transfer, $newStatus, $approverId) {
            $approverId ??= auth('sanctum')->id();

            $transfer->update(['status' => $newStatus]);

            if ($newStatus === AssetTransfer::STATUS_APPROVED) {
                $transfer->update(['approved_by' => $approverId]);
            }

            if ($newStatus === AssetTransfer::STATUS_COMPLETED) {
                $asset = $transfer->asset;
                $asset->update([
                    'campus_id' => $transfer->to_campus_id,
                    'faculty_id' => $transfer->to_faculty_id,
                    'department_id' => $transfer->to_department_id,
                    'building_id' => $transfer->to_building_id,
                    'floor_id' => $transfer->to_floor_id,
                    'room_id' => $transfer->to_room_id,
                ]);
                AssetService::recordLocation($asset, 'Asset transfer completed', $approverId);
            }

            $action = match ($newStatus) {
                AssetTransfer::STATUS_APPROVED => 'approved',
                AssetTransfer::STATUS_REJECTED => 'rejected',
                AssetTransfer::STATUS_IN_TRANSIT, AssetTransfer::STATUS_COMPLETED => 'transferred',
                default => 'updated',
            };

            ActivityLogService::record($action, 'Transfers', AssetTransfer::class, $transfer->id, $transfer->asset?->name, null, ['status' => $newStatus], $approverId);

            if ($newStatus === AssetTransfer::STATUS_APPROVED) {
                NotificationService::send(
                    (int) ($transfer->requested_by ?? $transfer->asset->created_by),
                    'transfer_approved',
                    'Transfer approved',
                    "Transfer of {$transfer->asset->name} was approved.",
                    'swap_horiz',
                );
            }

            return $transfer->fresh();
        });
    }

    /**
     * @return list<string>
     */
    protected static function allowedTransitions(string $current): array
    {
        return match ($current) {
            AssetTransfer::STATUS_DRAFT => [AssetTransfer::STATUS_REQUESTED, AssetTransfer::STATUS_REJECTED],
            AssetTransfer::STATUS_REQUESTED => [AssetTransfer::STATUS_APPROVED, AssetTransfer::STATUS_REJECTED],
            AssetTransfer::STATUS_APPROVED => [AssetTransfer::STATUS_IN_TRANSIT, AssetTransfer::STATUS_REJECTED],
            AssetTransfer::STATUS_IN_TRANSIT => [AssetTransfer::STATUS_COMPLETED, AssetTransfer::STATUS_REJECTED],
            default => [],
        };
    }
}

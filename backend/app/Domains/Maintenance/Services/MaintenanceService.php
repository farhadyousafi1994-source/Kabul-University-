<?php

namespace App\Domains\Maintenance\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Maintenance\Models\AssetMaintenance;
use App\Domains\Maintenance\Models\MaintenanceRequest;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 11 — Maintenance management.
 *
 * Requested → Approved → Technician Assigned → In Progress → Completed.
 * Asset status automation: under_maintenance while open, restored afterwards.
 */
class MaintenanceService
{
    public static function createRequest(array $data, ?int $requesterId = null): MaintenanceRequest
    {
        $requesterId ??= auth('sanctum')->id();

        $request = MaintenanceRequest::create([
            'asset_id' => $data['asset_id'],
            'requested_by' => $requesterId,
            'maintenance_type' => $data['maintenance_type'],
            'priority' => $data['priority'] ?? 'medium',
            'problem' => $data['problem'],
            'status' => MaintenanceRequest::STATUS_REQUESTED,
        ]);

        ActivityLogService::record('created', 'Maintenance', MaintenanceRequest::class, $request->id, $request->asset?->name, null, $data, $requesterId);

        return $request;
    }

    /**
     * Create a maintenance work order directly (with or without a request).
     */
    public static function createWorkOrder(array $data, ?int $userId = null): AssetMaintenance
    {
        $userId ??= auth('sanctum')->id();

        $maintenance = AssetMaintenance::create([
            'maintenance_request_id' => $data['maintenance_request_id'] ?? null,
            'asset_id' => $data['asset_id'],
            'technician_id' => $data['technician_id'] ?? null,
            'maintenance_type' => $data['maintenance_type'],
            'scheduled_date' => $data['scheduled_date'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'cost' => $data['cost'] ?? 0,
            'notes' => $data['notes'] ?? null,
            'status' => AssetMaintenance::STATUS_APPROVED,
        ]);

        $maintenance->asset()->update(['status' => Asset::STATUS_UNDER_MAINTENANCE]);

        ActivityLogService::record('created', 'Maintenance', AssetMaintenance::class, $maintenance->id, $maintenance->asset?->name, null, $data, $userId);

        return $maintenance;
    }

    /**
     * Transition a work order through its lifecycle.
     */
    public static function transition(AssetMaintenance $maintenance, string $newStatus, ?array $data = null): AssetMaintenance
    {
        $allowed = self::allowedTransitions($maintenance->status);

        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Invalid transition from '{$maintenance->status}' to '{$newStatus}'."],
            ]);
        }

        return DB::transaction(function () use ($maintenance, $newStatus, $data) {
            $update = ['status' => $newStatus];

            if ($newStatus === AssetMaintenance::STATUS_ASSIGNED && isset($data['technician_id'])) {
                $update['technician_id'] = $data['technician_id'];
            }
            if ($newStatus === AssetMaintenance::STATUS_IN_PROGRESS) {
                $update['start_date'] = $data['start_date'] ?? now()->toDateString();
                $maintenance->asset()->update(['status' => Asset::STATUS_UNDER_MAINTENANCE]);
            }
            if ($newStatus === AssetMaintenance::STATUS_COMPLETED) {
                $update['end_date'] = $data['end_date'] ?? now()->toDateString();
                $update['result'] = $data['result'] ?? $update['result'] ?? 'Completed successfully';
                $update['cost'] = $data['cost'] ?? $maintenance->cost;

                $asset = $maintenance->asset;
                // Restore the asset to an appropriate status (available unless
                // it has an active assignment — assignments are not auto-created).
                $asset->update([
                    'status' => Asset::STATUS_AVAILABLE,
                    'condition' => $data['condition'] ?? $asset->condition,
                ]);
            }

            $maintenance->update($update);

            $action = match ($newStatus) {
                AssetMaintenance::STATUS_APPROVED => 'approved',
                AssetMaintenance::STATUS_COMPLETED => 'maintained',
                default => 'updated',
            };

            ActivityLogService::record($action, 'Maintenance', AssetMaintenance::class, $maintenance->id, $maintenance->asset?->name, null, $update);

            if ($newStatus === AssetMaintenance::STATUS_COMPLETED) {
                NotificationService::send(
                    (int) ($maintenance->maintenance_request_id
                        ? $maintenance->request?->requested_by
                        : $maintenance->asset?->created_by),
                    'maintenance_completed',
                    'Maintenance completed',
                    "Maintenance of {$maintenance->asset->name} was completed (cost: {$maintenance->cost}).",
                    'build',
                );
            }

            return $maintenance->fresh();
        });
    }

    /**
     * Approve the originating request when its work order is approved.
     */
    public static function approveRequest(MaintenanceRequest $request): MaintenanceRequest
    {
        if ($request->status !== MaintenanceRequest::STATUS_REQUESTED) {
            throw ValidationException::withMessages([
                'status' => ['Only requested maintenance can be approved.'],
            ]);
        }

        $request->update(['status' => MaintenanceRequest::STATUS_APPROVED]);
        ActivityLogService::record('approved', 'Maintenance', MaintenanceRequest::class, $request->id, $request->asset?->name);

        return $request->fresh();
    }

    /**
     * @return list<string>
     */
    protected static function allowedTransitions(string $current): array
    {
        return match ($current) {
            AssetMaintenance::STATUS_REQUESTED => [AssetMaintenance::STATUS_APPROVED, AssetMaintenance::STATUS_CANCELLED],
            AssetMaintenance::STATUS_APPROVED => [AssetMaintenance::STATUS_ASSIGNED, AssetMaintenance::STATUS_IN_PROGRESS, AssetMaintenance::STATUS_CANCELLED],
            AssetMaintenance::STATUS_ASSIGNED => [AssetMaintenance::STATUS_IN_PROGRESS, AssetMaintenance::STATUS_CANCELLED],
            AssetMaintenance::STATUS_IN_PROGRESS => [AssetMaintenance::STATUS_COMPLETED, AssetMaintenance::STATUS_CANCELLED],
            default => [],
        };
    }
}

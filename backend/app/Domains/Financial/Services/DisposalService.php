<?php

namespace App\Domains\Financial\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Financial\Models\AssetDisposal;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 19 — Asset disposal & retirement.
 *
 * Disposal Request → Inspection → Approval → Disposal → Completed.
 * The asset is NEVER deleted; its status becomes `disposed`.
 */
class DisposalService
{
    public static function request(array $data): AssetDisposal
    {
        $disposal = AssetDisposal::create([
            'asset_id' => $data['asset_id'],
            'method' => $data['method'],
            'requested_by' => auth('sanctum')->id(),
            'request_date' => now()->toDateString(),
            'status' => AssetDisposal::STATUS_REQUESTED,
            'notes' => $data['notes'] ?? null,
        ]);

        ActivityLogService::record('requested', 'Disposal', AssetDisposal::class, $disposal->id, $disposal->asset?->name, null, $data);

        return $disposal;
    }

    public static function inspect(AssetDisposal $disposal, ?string $notes = null): AssetDisposal
    {
        $disposal->update([
            'status' => AssetDisposal::STATUS_INSPECTED,
            'notes' => $notes ?? $disposal->notes,
        ]);

        ActivityLogService::record('updated', 'Disposal', AssetDisposal::class, $disposal->id, $disposal->asset?->name, null, ['status' => 'inspected']);

        return $disposal->fresh();
    }

    public static function approve(AssetDisposal $disposal, bool $approve): AssetDisposal
    {
        if (! in_array($disposal->status, [AssetDisposal::STATUS_REQUESTED, AssetDisposal::STATUS_INSPECTED], true)) {
            throw ValidationException::withMessages(['status' => ['Disposal is not awaiting approval.']]);
        }

        return DB::transaction(function () use ($disposal, $approve) {
            $disposal->update([
                'status' => $approve ? AssetDisposal::STATUS_APPROVED : AssetDisposal::STATUS_REJECTED,
                'approved_by' => $approve ? auth('sanctum')->id() : $disposal->approved_by,
                'approval_date' => $approve ? now()->toDateString() : null,
            ]);

            ActivityLogService::record($approve ? 'approved' : 'rejected', 'Disposal', AssetDisposal::class, $disposal->id, $disposal->asset?->name);

            return $disposal->fresh();
        });
    }

    /**
     * Execute the disposal: asset status becomes `disposed`, revenue is
     * recorded, historical records are preserved.
     */
    public static function execute(AssetDisposal $disposal, ?float $revenue = null, ?string $notes = null): AssetDisposal
    {
        if ($disposal->status !== AssetDisposal::STATUS_APPROVED) {
            throw ValidationException::withMessages(['status' => ['Only approved disposals can be executed.']]);
        }

        return DB::transaction(function () use ($disposal, $revenue, $notes) {
            $disposal->update([
                'status' => AssetDisposal::STATUS_COMPLETED,
                'disposal_date' => now()->toDateString(),
                'revenue' => $revenue ?? $disposal->revenue,
                'notes' => $notes ?? $disposal->notes,
            ]);

            $asset = $disposal->asset;
            $asset->update([
                'status' => Asset::STATUS_DISPOSED,
                'current_value' => 0,
            ]);

            ActivityLogService::record('disposed', 'Disposal', Asset::class, $asset->id, $asset->name, null, [
                'method' => $disposal->method,
                'revenue' => $disposal->revenue,
            ]);

            NotificationService::send(
                (int) ($disposal->requested_by ?? $asset->created_by),
                'asset_disposed',
                'Asset disposal completed',
                "{$asset->name} ({$asset->asset_code}) was {$disposal->method}.",
                'delete_forever',
            );

            return $disposal->fresh('asset');
        });
    }
}

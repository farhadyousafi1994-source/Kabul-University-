<?php

namespace App\Domains\Audit\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Audit\Models\AssetAudit;
use App\Domains\Audit\Models\AssetAuditItem;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 14 — Asset audit & physical verification.
 *
 * Create Audit → Select Scope → Auditor Assigned → Scan Assets → Verify → Complete.
 */
class AuditService
{
    public static function create(array $data): AssetAudit
    {
        $audit = AssetAudit::create([
            'audit_code' => 'AUD-'.now()->format('Y').'-'.str_pad((string) (AssetAudit::count() + 1), 4, '0', STR_PAD_LEFT),
            'auditor_id' => $data['auditor_id'] ?? auth('sanctum')->id(),
            'scope_type' => $data['scope_type'] ?? null,
            'scope_id' => $data['scope_id'] ?? null,
            'scheduled_at' => $data['scheduled_at'] ?? now()->toDateString(),
            'status' => AssetAudit::STATUS_DRAFT,
        ]);

        // Pre-populate audit items from the scope so verification is a
        // check-off process (missing assets are detected automatically).
        if ($audit->scope_type && $audit->scope_id) {
            $assets = Asset::where($audit->scope_type.'_id', $audit->scope_id)
                ->whereNotIn('status', [Asset::STATUS_DISPOSED])
                ->get();

            foreach ($assets as $asset) {
                AssetAuditItem::firstOrCreate(
                    ['asset_audit_id' => $audit->id, 'asset_id' => $asset->id],
                );
            }
        }

        ActivityLogService::record('created', 'Audit', AssetAudit::class, $audit->id, $audit->audit_code, null, $data);

        return $audit->fresh('items', 'auditor');
    }

    public static function start(AssetAudit $audit): AssetAudit
    {
        if ($audit->status !== AssetAudit::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => ['Only draft audits can be started.']]);
        }

        $audit->update([
            'status' => AssetAudit::STATUS_IN_PROGRESS,
            'started_at' => now(),
        ]);

        ActivityLogService::record('updated', 'Audit', AssetAudit::class, $audit->id, $audit->audit_code, null, ['status' => 'in_progress']);

        return $audit->fresh();
    }

    /**
     * Verify an asset by QR/barcode scan (or manual selection).
     */
    public static function verify(AssetAudit $audit, Asset $asset, string $verification, ?string $notes = null): AssetAuditItem
    {
        if ($audit->status !== AssetAudit::STATUS_IN_PROGRESS) {
            throw ValidationException::withMessages(['status' => ['Audit must be in progress to verify assets.']]);
        }

        if (! in_array($verification, AssetAuditItem::VERIFICATIONS, true)) {
            throw ValidationException::withMessages(['verification' => ['Invalid verification result.']]);
        }

        return DB::transaction(function () use ($audit, $asset, $verification, $notes) {
            $item = AssetAuditItem::updateOrCreate(
                ['asset_audit_id' => $audit->id, 'asset_id' => $asset->id],
                [
                    'scanned_at' => now(),
                    'verification' => $verification,
                    'notes' => $notes,
                ],
            );

            ActivityLogService::record('verified', 'Audit', AssetAuditItem::class, $item->id, $asset->name, null, [
                'verification' => $verification,
            ]);

            return $item;
        });
    }

    /**
     * Complete the audit: unverified items become "missing", a summary is
     * generated and the auditor is notified.
     */
    public static function complete(AssetAudit $audit): AssetAudit
    {
        if ($audit->status !== AssetAudit::STATUS_IN_PROGRESS) {
            throw ValidationException::withMessages(['status' => ['Only in-progress audits can be completed.']]);
        }

        return DB::transaction(function () use ($audit) {
            // Anything never scanned → missing.
            $audit->items()->whereNull('verification')->update(['verification' => AssetAuditItem::MISSING]);

            $counts = $audit->items()->selectRaw('verification, COUNT(*) as c')->groupBy('verification')->pluck('c', 'verification');

            $summary = sprintf(
                '%d verified, %d missing, %d wrong location, %d damaged (of %d scheduled)',
                (int) $counts[AssetAuditItem::VERIFIED],
                (int) $counts[AssetAuditItem::MISSING],
                (int) $counts[AssetAuditItem::WRONG_LOCATION],
                (int) $counts[AssetAuditItem::DAMAGED],
                $audit->items()->count(),
            );

            $audit->update([
                'status' => AssetAudit::STATUS_COMPLETED,
                'completed_at' => now(),
                'summary' => $summary,
            ]);

            ActivityLogService::record('completed', 'Audit', AssetAudit::class, $audit->id, $audit->audit_code, null, ['summary' => $summary]);

            if ($audit->auditor_id) {
                NotificationService::send(
                    $audit->auditor_id,
                    'audit_completed',
                    'Audit completed',
                    "{$audit->audit_code}: {$summary}",
                    'fact_check',
                );
            }

            return $audit->fresh('items');
        });
    }

    public static function cancel(AssetAudit $audit): AssetAudit
    {
        $audit->update(['status' => AssetAudit::STATUS_CANCELLED]);
        ActivityLogService::record('updated', 'Audit', AssetAudit::class, $audit->id, $audit->audit_code, null, ['status' => 'cancelled']);

        return $audit->fresh();
    }
}

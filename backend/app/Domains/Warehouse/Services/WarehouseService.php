<?php

namespace App\Domains\Warehouse\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\Warehouse\Models\Warehouse;
use App\Domains\Warehouse\Models\WarehouseTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 17 — Warehouse & inventory control.
 * Transaction types: IN, OUT, TRANSFER, ADJUSTMENT (immutable history).
 */
class WarehouseService
{
    public static function transaction(
        Asset $asset,
        Warehouse $warehouse,
        string $type,
        array $data = [],
        ?int $userId = null,
    ): WarehouseTransaction {
        if (! in_array($type, WarehouseTransaction::TYPES, true)) {
            throw ValidationException::withMessages(['type' => ['Invalid transaction type.']]);
        }

        $userId ??= auth('sanctum')->id();

        $transaction = WarehouseTransaction::create([
            'asset_id' => $asset->id,
            'warehouse_id' => $warehouse->id,
            'type' => $type,
            'quantity' => $data['quantity'] ?? 1,
            'reference_type' => $data['reference_type'] ?? null,
            'reference_id' => $data['reference_id'] ?? null,
            'user_id' => $userId,
            'notes' => $data['notes'] ?? null,
        ]);

        ActivityLogService::record('created', 'Warehouse', WarehouseTransaction::class, $transaction->id, $asset->name, null, [
            'type' => $type,
            'warehouse' => $warehouse->name,
        ], $userId);

        return $transaction;
    }

    /**
     * Transfer an asset between warehouses (OUT at source + IN at target).
     */
    public static function transfer(Asset $asset, Warehouse $from, Warehouse $to, ?string $notes = null): array
    {
        return DB::transaction(function () use ($asset, $from, $to, $notes) {
            $out = self::transaction($asset, $from, WarehouseTransaction::TYPE_OUT, [
                'quantity' => 1,
                'notes' => $notes ? "Transfer to {$to->name}" : null,
                'reference_type' => 'warehouse_transfer',
            ]);
            $in = self::transaction($asset, $to, WarehouseTransaction::TYPE_IN, [
                'quantity' => 1,
                'notes' => $notes ? "Transfer from {$from->name}" : null,
                'reference_type' => 'warehouse_transfer',
            ]);

            return [$out, $in];
        });
    }

    /**
     * Current stock of an asset inside a warehouse (sum of IN minus OUT).
     */
    public static function stock(Asset $asset, Warehouse $warehouse): int
    {
        $in = WarehouseTransaction::where('asset_id', $asset->id)
            ->where('warehouse_id', $warehouse->id)
            ->whereIn('type', [WarehouseTransaction::TYPE_IN])
            ->sum('quantity');
        $out = WarehouseTransaction::where('asset_id', $asset->id)
            ->where('warehouse_id', $warehouse->id)
            ->whereIn('type', [WarehouseTransaction::TYPE_OUT])
            ->sum('quantity');

        return max(0, (int) $in - (int) $out);
    }
}

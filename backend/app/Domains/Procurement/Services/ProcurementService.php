<?php

namespace App\Domains\Procurement\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Services\AssetService;
use App\Domains\Procurement\Models\PurchaseOrder;
use App\Domains\Procurement\Models\PurchaseReceipt;
use App\Domains\Procurement\Models\PurchaseRequest;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\Warehouse\Models\WarehouseTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Module 16 — Procurement lifecycle.
 *
 * Purchase Request → Approval → Purchase Order → Supplier → Receiving → Asset Registration.
 * Receiving creates real asset records (one per received unit) with generated
 * codes, barcodes, QR codes and warehouse IN transactions.
 */
class ProcurementService
{
    public static function createPurchaseRequest(array $data, ?int $userId = null): PurchaseRequest
    {
        $userId ??= auth('sanctum')->id();

        $pr = PurchaseRequest::create([
            'pr_number' => 'PR-'.now()->format('Y').'-'.str_pad((string) (PurchaseRequest::count() + 1), 4, '0', STR_PAD_LEFT),
            'requested_by' => $userId,
            'department_id' => $data['department_id'] ?? null,
            'supplier_id' => $data['supplier_id'] ?? null,
            'status' => PurchaseRequest::STATUS_DRAFT,
            'notes' => $data['notes'] ?? null,
        ]);

        ActivityLogService::record('created', 'Procurement', PurchaseRequest::class, $pr->id, $pr->pr_number, null, $data, $userId);

        return $pr;
    }

    public static function approvePurchaseRequest(PurchaseRequest $pr, bool $approve): PurchaseRequest
    {
        $pr->update(['status' => $approve ? PurchaseRequest::STATUS_APPROVED : PurchaseRequest::STATUS_REJECTED]);

        ActivityLogService::record($approve ? 'approved' : 'rejected', 'Procurement', PurchaseRequest::class, $pr->id, $pr->pr_number);

        return $pr->fresh();
    }

    /**
     * Create a purchase order with its items and compute totals.
     *
     * @param  array{items: array<int, array{name: string, quantity: int, unit_price: float, brand?: string|null, model?: string|null, asset_category_id?: int|null}>}  $data
     */
    public static function createPurchaseOrder(array $data): PurchaseOrder
    {
        if (empty($data['items'])) {
            throw ValidationException::withMessages(['items' => ['At least one item is required.']]);
        }

        return DB::transaction(function () use ($data) {
            $subtotal = collect($data['items'])->sum(fn ($item) => $item['quantity'] * $item['unit_price']);
            $tax = (float) ($data['tax'] ?? 0);
            $total = $subtotal + $tax;

            $po = PurchaseOrder::create([
                'po_number' => 'PO-'.now()->format('Y').'-'.str_pad((string) (PurchaseOrder::count() + 1), 4, '0', STR_PAD_LEFT),
                'purchase_request_id' => $data['purchase_request_id'] ?? null,
                'supplier_id' => $data['supplier_id'],
                'status' => PurchaseOrder::STATUS_DRAFT,
                'order_date' => $data['order_date'] ?? now()->toDateString(),
                'expected_date' => $data['expected_date'] ?? null,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'total' => $total,
                'created_by' => auth('sanctum')->id(),
            ]);

            foreach ($data['items'] as $item) {
                $po->items()->create($item);
            }

            if ($data['purchase_request_id'] ?? null) {
                PurchaseRequest::whereKey($data['purchase_request_id'])->update(['status' => PurchaseRequest::STATUS_ORDERED]);
            }

            ActivityLogService::record('created', 'Procurement', PurchaseOrder::class, $po->id, $po->po_number, null, $data);

            return $po->fresh('items', 'supplier');
        });
    }

    public static function sendOrder(PurchaseOrder $po): PurchaseOrder
    {
        $po->update(['status' => PurchaseOrder::STATUS_SENT]);
        ActivityLogService::record('submitted', 'Procurement', PurchaseOrder::class, $po->id, $po->po_number);

        return $po->fresh();
    }

    /**
     * Receive goods against an order: registers assets for every received
     * unit (serial numbers optional, auto-generated), records warehouse IN
     * transactions and updates the PO status.
     *
     * @param  array{warehouse_id?: int|null, received_date?: string|null, notes?: string|null}  $data
     */
    public static function receive(PurchaseOrder $po, array $data): PurchaseReceipt
    {
        $user = auth('sanctum')->user();
        $warehouseId = $data['warehouse_id'] ?? null;

        $receipt = DB::transaction(function () use ($po, $data, $warehouseId, $user) {
            $assetsCreated = [];

            foreach ($po->items as $item) {
                $remaining = $item->quantity - $item->received_quantity;
                if ($remaining <= 0) {
                    continue;
                }

                for ($i = 0; $i < $remaining; $i++) {
                    $category = $item->category;

                    $asset = AssetService::create([
                        'name' => $item->name,
                        'category_id' => $item->asset_category_id ?? $category->id,
                        'brand' => $item->brand,
                        'model' => $item->model,
                        'purchase_date' => $data['received_date'] ?? now()->toDateString(),
                        'purchase_price' => $item->unit_price,
                        'current_value' => $item->unit_price,
                        'supplier_id' => $po->supplier_id,
                        'useful_life' => (int) \App\Domains\System\Services\SettingsService::get('default_useful_life', 5),
                        'status' => Asset::STATUS_AVAILABLE,
                        'condition' => Asset::CONDITION_EXCELLENT,
                        'campus_id' => null,
                        'created_by' => $user->id,
                    ], $user->id);

                    $assetsCreated[] = $asset->id;

                    if ($warehouseId) {
                        WarehouseTransaction::create([
                            'asset_id' => $asset->id,
                            'warehouse_id' => $warehouseId,
                            'type' => WarehouseTransaction::TYPE_IN,
                            'quantity' => 1,
                            'reference_type' => 'purchase_order',
                            'reference_id' => $po->id,
                            'user_id' => $user->id,
                            'notes' => "Received from {$po->po_number}",
                        ]);
                    }
                }

                $item->update(['received_quantity' => $item->received_quantity + $remaining]);
            }

            $receipt = PurchaseReceipt::create([
                'receipt_number' => 'RCV-'.now()->format('Y').'-'.str_pad((string) (PurchaseReceipt::count() + 1), 4, '0', STR_PAD_LEFT),
                'purchase_order_id' => $po->id,
                'warehouse_id' => $warehouseId,
                'received_by' => $user->id,
                'received_date' => $data['received_date'] ?? now()->toDateString(),
                'notes' => $data['notes'] ?? null,
            ]);

            $allReceived = $po->items->every(fn ($item) => $item->received_quantity >= $item->quantity);
            $po->update(['status' => $allReceived ? PurchaseOrder::STATUS_RECEIVED : PurchaseOrder::STATUS_PARTIALLY_RECEIVED]);

            ActivityLogService::record('created', 'Procurement', PurchaseReceipt::class, $receipt->id, $receipt->receipt_number, null, [
                'po_number' => $po->po_number,
                'assets_created' => $assetsCreated,
            ], $user->id);

            return $receipt;
        });

        return $receipt->load('purchaseOrder', 'warehouse');
    }
}

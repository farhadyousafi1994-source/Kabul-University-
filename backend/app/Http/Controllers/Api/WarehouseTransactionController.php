<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Warehouse\Models\Warehouse;
use App\Domains\Warehouse\Models\WarehouseTransaction;
use App\Domains\Warehouse\Resources\WarehouseTransactionResource;
use App\Domains\Warehouse\Services\WarehouseService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Module 17 — Warehouse transactions (IN / OUT / TRANSFER / ADJUSTMENT).
 */
class WarehouseTransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = WarehouseTransaction::query()
            ->with(['asset', 'warehouse', 'user'])
            ->when($request->get('type'), fn ($q, $t) => $q->where('type', $t))
            ->when($request->get('warehouse_id'), fn ($q, $v) => $q->where('warehouse_id', (int) $v))
            ->when($request->get('asset_id'), fn ($q, $v) => $q->where('asset_id', (int) $v))
            ->when($request->get('search'), function ($q, $search) {
                $q->whereHas('asset', fn ($a) => $a->where('name', 'like', "%{$search}%")->orWhere('asset_code', 'like', "%{$search}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Transactions retrieved successfully.', WarehouseTransactionResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'type' => ['required', Rule::in(WarehouseTransaction::TYPES)],
            'quantity' => ['sometimes', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
        ]);

        $transaction = WarehouseService::transaction(
            Asset::findOrFail($request->input('asset_id')),
            Warehouse::findOrFail($request->input('warehouse_id')),
            $request->input('type'),
            $request->only(['quantity', 'notes', 'reference_type', 'reference_id']),
        );

        return ApiResponse::success('Transaction recorded successfully.', new WarehouseTransactionResource($transaction->load('asset', 'warehouse')), null, 201);
    }

    public function transfer(Request $request): JsonResponse
    {
        $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'from_warehouse_id' => ['required', 'integer', 'exists:warehouses,id', 'different:to_warehouse_id'],
            'to_warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'notes' => ['nullable', 'string'],
        ]);

        [$out, $in] = WarehouseService::transfer(
            Asset::findOrFail($request->input('asset_id')),
            Warehouse::findOrFail($request->input('from_warehouse_id')),
            Warehouse::findOrFail($request->input('to_warehouse_id')),
            $request->input('notes'),
        );

        return ApiResponse::success('Asset transferred between warehouses successfully.', [
            'out' => new WarehouseTransactionResource($out->load('asset', 'warehouse')),
            'in' => new WarehouseTransactionResource($in->load('asset', 'warehouse')),
        ]);
    }
}

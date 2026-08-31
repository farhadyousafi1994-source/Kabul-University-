<?php

namespace App\Http\Controllers\Api;

use App\Domains\Procurement\Models\PurchaseOrder;
use App\Domains\Procurement\Models\PurchaseRequest;
use App\Domains\Procurement\Requests\PurchaseOrderRequest;
use App\Domains\Procurement\Requests\PurchaseRequestRequest;
use App\Domains\Procurement\Requests\ReceiveRequest;
use App\Domains\Procurement\Resources\PurchaseOrderResource;
use App\Domains\Procurement\Resources\PurchaseReceiptResource;
use App\Domains\Procurement\Resources\PurchaseRequestResource;
use App\Domains\Procurement\Services\ProcurementService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 16 — Procurement lifecycle.
 */
class ProcurementController extends Controller
{
    // ------------------------------------------------------------------
    // Purchase requests
    // ------------------------------------------------------------------

    public function purchaseRequests(Request $request): JsonResponse
    {
        $query = PurchaseRequest::query()
            ->with(['requester', 'department', 'supplier'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Purchase requests retrieved successfully.', PurchaseRequestResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function storePurchaseRequest(PurchaseRequestRequest $request): JsonResponse
    {
        $pr = ProcurementService::createPurchaseRequest($request->validated());

        return ApiResponse::success('Purchase request created successfully.', new PurchaseRequestResource($pr->load('requester', 'department', 'supplier')), null, 201);
    }

    public function approvePurchaseRequest(Request $request, PurchaseRequest $purchaseRequest): JsonResponse
    {
        $purchaseRequest = ProcurementService::approvePurchaseRequest($purchaseRequest, (bool) $request->input('approve', true));

        return ApiResponse::success('Purchase request updated successfully.', new PurchaseRequestResource($purchaseRequest));
    }

    // ------------------------------------------------------------------
    // Purchase orders
    // ------------------------------------------------------------------

    public function purchaseOrders(Request $request): JsonResponse
    {
        $query = PurchaseOrder::query()
            ->with(['supplier', 'purchaseRequest', 'items', 'creator'])
            ->withCount('receipts')
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('supplier_id'), fn ($q, $v) => $q->where('supplier_id', (int) $v))
            ->when($request->get('search'), fn ($q, $s) => $q->where('po_number', 'like', "%{$s}%"))
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Purchase orders retrieved successfully.', PurchaseOrderResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function storePurchaseOrder(PurchaseOrderRequest $request): JsonResponse
    {
        $po = ProcurementService::createPurchaseOrder($request->validated());

        return ApiResponse::success('Purchase order created successfully.', new PurchaseOrderResource($po->load('supplier', 'items')), null, 201);
    }

    public function sendOrder(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $purchaseOrder = ProcurementService::sendOrder($purchaseOrder);

        return ApiResponse::success('Purchase order sent to supplier successfully.', new PurchaseOrderResource($purchaseOrder->load('supplier', 'items')));
    }

    public function receive(ReceiveRequest $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $receipt = ProcurementService::receive($purchaseOrder, $request->validated());

        return ApiResponse::success('Goods received and assets registered successfully.', new PurchaseReceiptResource($receipt), null, 201);
    }

    public function purchaseOrderShow(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return ApiResponse::success('Purchase order retrieved successfully.', new PurchaseOrderResource($purchaseOrder->load('supplier', 'purchaseRequest', 'items', 'receipts', 'creator')));
    }
}

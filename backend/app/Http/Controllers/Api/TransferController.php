<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetTransfer;
use App\Domains\Asset\Requests\TransferRequest;
use App\Domains\Asset\Requests\TransferStatusRequest;
use App\Domains\Asset\Resources\AssetTransferResource;
use App\Domains\Asset\Services\TransferService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 9 — Transfers & location history.
 */
class TransferController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AssetTransfer::query()
            ->with(['asset', 'requester', 'approver'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('asset_id'), fn ($q, $v) => $q->where('asset_id', (int) $v))
            ->when($request->get('search'), function ($q, $search) {
                $q->whereHas('asset', fn ($a) => $a->where('name', 'like', "%{$search}%")->orWhere('asset_code', 'like', "%{$search}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Transfers retrieved successfully.', AssetTransferResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(TransferRequest $request, Asset $asset): JsonResponse
    {
        $transfer = TransferService::create($asset, $request->validated());

        return ApiResponse::success('Transfer request created successfully.', new AssetTransferResource($transfer->load('asset', 'requester')), null, 201);
    }

    public function show(AssetTransfer $transfer): JsonResponse
    {
        return ApiResponse::success('Transfer retrieved successfully.', new AssetTransferResource($transfer->load('asset', 'requester', 'approver')));
    }

    public function transition(TransferStatusRequest $request, AssetTransfer $transfer): JsonResponse
    {
        $transfer = TransferService::transition($transfer, $request->input('status'));

        return ApiResponse::success('Transfer status updated successfully.', new AssetTransferResource($transfer->load('asset', 'requester', 'approver')));
    }
}

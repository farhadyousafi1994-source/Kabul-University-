<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\AssetRequest;
use App\Domains\Asset\Requests\AssetRequestRequest;
use App\Domains\Asset\Resources\AssetRequestResource;
use App\Domains\Asset\Services\AssetRequestService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 10 — Asset request & approval workflow.
 */
class AssetRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AssetRequest::query()
            ->with(['requester', 'department', 'category'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('request_type'), fn ($q, $t) => $q->where('request_type', $t))
            ->when($request->get('search'), function ($q, $search) {
                $q->where('request_number', 'like', "%{$search}%")
                    ->orWhereHas('requester', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Asset requests retrieved successfully.', AssetRequestResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(AssetRequestRequest $request): JsonResponse
    {
        $assetRequest = AssetRequestService::create($request->validated());

        return ApiResponse::success('Asset request created successfully.', new AssetRequestResource($assetRequest->load('requester', 'department', 'category')), null, 201);
    }

    public function show(AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success('Asset request retrieved successfully.', new AssetRequestResource($assetRequest->load('requester', 'department', 'category')));
    }

    public function submit(AssetRequest $assetRequest): JsonResponse
    {
        $assetRequest = AssetRequestService::submit($assetRequest);

        return ApiResponse::success('Asset request submitted successfully.', new AssetRequestResource($assetRequest));
    }

    public function departmentApprove(Request $request, AssetRequest $assetRequest): JsonResponse
    {
        $assetRequest = AssetRequestService::departmentApprove($assetRequest, (bool) $request->input('approve', true));

        return ApiResponse::success('Asset request updated successfully.', new AssetRequestResource($assetRequest));
    }

    public function managerApprove(Request $request, AssetRequest $assetRequest): JsonResponse
    {
        $assetRequest = AssetRequestService::managerApprove($assetRequest, (bool) $request->input('approve', true));

        return ApiResponse::success('Asset request updated successfully.', new AssetRequestResource($assetRequest));
    }

    public function complete(AssetRequest $assetRequest): JsonResponse
    {
        $assetRequest = AssetRequestService::complete($assetRequest);

        return ApiResponse::success('Asset request completed successfully.', new AssetRequestResource($assetRequest));
    }
}

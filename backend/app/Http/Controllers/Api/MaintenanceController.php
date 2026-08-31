<?php

namespace App\Http\Controllers\Api;

use App\Domains\Maintenance\Models\AssetMaintenance;
use App\Domains\Maintenance\Models\MaintenanceRequest;
use App\Domains\Maintenance\Requests\MaintenanceRequestRequest;
use App\Domains\Maintenance\Requests\WorkOrderRequest;
use App\Domains\Maintenance\Requests\WorkOrderStatusRequest;
use App\Domains\Maintenance\Resources\AssetMaintenanceResource;
use App\Domains\Maintenance\Resources\MaintenanceRequestResource;
use App\Domains\Maintenance\Services\MaintenanceService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 11 — Maintenance management.
 */
class MaintenanceController extends Controller
{
    // ------------------------------------------------------------------
    // Maintenance requests
    // ------------------------------------------------------------------

    public function requests(Request $request): JsonResponse
    {
        $query = MaintenanceRequest::query()
            ->with(['asset', 'requester'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('maintenance_type'), fn ($q, $t) => $q->where('maintenance_type', $t))
            ->when($request->get('search'), function ($q, $search) {
                $q->whereHas('asset', fn ($a) => $a->where('name', 'like', "%{$search}%")->orWhere('asset_code', 'like', "%{$search}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Maintenance requests retrieved successfully.', MaintenanceRequestResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function storeRequest(MaintenanceRequestRequest $request): JsonResponse
    {
        $maintenanceRequest = MaintenanceService::createRequest($request->validated());

        return ApiResponse::success('Maintenance request created successfully.', new MaintenanceRequestResource($maintenanceRequest->load('asset', 'requester')), null, 201);
    }

    public function approveRequest(MaintenanceRequest $maintenanceRequest): JsonResponse
    {
        $maintenanceRequest = MaintenanceService::approveRequest($maintenanceRequest);

        return ApiResponse::success('Maintenance request approved successfully.', new MaintenanceRequestResource($maintenanceRequest));
    }

    // ------------------------------------------------------------------
    // Work orders
    // ------------------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        $query = AssetMaintenance::query()
            ->with(['asset', 'technician', 'request'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('maintenance_type'), fn ($q, $t) => $q->where('maintenance_type', $t))
            ->when($request->get('asset_id'), fn ($q, $v) => $q->where('asset_id', (int) $v))
            ->when($request->get('search'), function ($q, $search) {
                $q->whereHas('asset', fn ($a) => $a->where('name', 'like', "%{$search}%")->orWhere('asset_code', 'like', "%{$search}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Maintenance records retrieved successfully.', AssetMaintenanceResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(WorkOrderRequest $request): JsonResponse
    {
        $maintenance = MaintenanceService::createWorkOrder($request->validated());

        return ApiResponse::success('Work order created successfully.', new AssetMaintenanceResource($maintenance->load('asset', 'technician')), null, 201);
    }

    public function show(AssetMaintenance $maintenance): JsonResponse
    {
        return ApiResponse::success('Maintenance record retrieved successfully.', new AssetMaintenanceResource($maintenance->load('asset', 'technician', 'request')));
    }

    public function transition(WorkOrderStatusRequest $request, AssetMaintenance $maintenance): JsonResponse
    {
        $maintenance = MaintenanceService::transition($maintenance, $request->input('status'), $request->validated());

        return ApiResponse::success('Maintenance status updated successfully.', new AssetMaintenanceResource($maintenance->load('asset', 'technician', 'request')));
    }
}

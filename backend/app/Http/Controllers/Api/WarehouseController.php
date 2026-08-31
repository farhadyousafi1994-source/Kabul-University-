<?php

namespace App\Http\Controllers\Api;

use App\Domains\Warehouse\Resources\WarehouseResource;
use App\Domains\Warehouse\Requests\WarehouseRequest;
use App\Domains\Warehouse\Models\Warehouse;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Warehouse\Models\Warehouse::class, 'Warehouse');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('warehouse.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', WarehouseResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(WarehouseRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new WarehouseResource($model), null, 201);
    }

    public function show(Warehouse $warehouse): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new WarehouseResource($warehouse));
    }

    public function update(WarehouseRequest $request, Warehouse $warehouse): JsonResponse
    {
        $model = $this->service->update($warehouse, $request->validated());

        return ApiResponse::success('Updated successfully.', new WarehouseResource($model));
    }

    public function destroy(Warehouse $warehouse): JsonResponse
    {
        $this->service->archive($warehouse);

        return ApiResponse::success('Archived successfully.');
    }
}

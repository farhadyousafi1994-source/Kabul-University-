<?php

namespace App\Http\Controllers\Api;

use App\Domains\Procurement\Resources\SupplierResource;
use App\Domains\Procurement\Requests\SupplierRequest;
use App\Domains\Procurement\Models\Supplier;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Procurement\Models\Supplier::class, 'Suppliers');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('suppliers.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', SupplierResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(SupplierRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new SupplierResource($model), null, 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new SupplierResource($supplier));
    }

    public function update(SupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $model = $this->service->update($supplier, $request->validated());

        return ApiResponse::success('Updated successfully.', new SupplierResource($model));
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        $this->service->archive($supplier);

        return ApiResponse::success('Archived successfully.');
    }
}

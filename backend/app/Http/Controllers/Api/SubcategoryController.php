<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Resources\AssetSubcategoryResource;
use App\Domains\Asset\Requests\AssetSubcategoryRequest;
use App\Domains\Asset\Models\AssetSubcategory;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubcategoryController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Asset\Models\AssetSubcategory::class, 'Categories');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('categories.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', AssetSubcategoryResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(AssetSubcategoryRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new AssetSubcategoryResource($model), null, 201);
    }

    public function show(AssetSubcategory $subcategory): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new AssetSubcategoryResource($subcategory));
    }

    public function update(AssetSubcategoryRequest $request, AssetSubcategory $subcategory): JsonResponse
    {
        $model = $this->service->update($subcategory, $request->validated());

        return ApiResponse::success('Updated successfully.', new AssetSubcategoryResource($model));
    }

    public function destroy(AssetSubcategory $subcategory): JsonResponse
    {
        $this->service->archive($subcategory);

        return ApiResponse::success('Archived successfully.');
    }
}

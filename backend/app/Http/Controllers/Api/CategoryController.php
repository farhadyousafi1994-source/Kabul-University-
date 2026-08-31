<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Resources\AssetCategoryResource;
use App\Domains\Asset\Requests\AssetCategoryRequest;
use App\Domains\Asset\Models\AssetCategory;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Asset\Models\AssetCategory::class, 'Categories');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('categories.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', AssetCategoryResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(AssetCategoryRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new AssetCategoryResource($model), null, 201);
    }

    public function show(AssetCategory $category): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new AssetCategoryResource($category));
    }

    public function update(AssetCategoryRequest $request, AssetCategory $category): JsonResponse
    {
        $model = $this->service->update($category, $request->validated());

        return ApiResponse::success('Updated successfully.', new AssetCategoryResource($model));
    }

    public function destroy(AssetCategory $category): JsonResponse
    {
        $this->service->archive($category);

        return ApiResponse::success('Archived successfully.');
    }
}

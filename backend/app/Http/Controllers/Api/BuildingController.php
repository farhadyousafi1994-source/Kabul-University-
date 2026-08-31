<?php

namespace App\Http\Controllers\Api;

use App\Domains\Organization\Resources\BuildingResource;
use App\Domains\Organization\Requests\BuildingRequest;
use App\Domains\Organization\Models\Building;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BuildingController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Organization\Models\Building::class, 'Organization');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('organization.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', BuildingResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(BuildingRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new BuildingResource($model), null, 201);
    }

    public function show(Building $building): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new BuildingResource($building));
    }

    public function update(BuildingRequest $request, Building $building): JsonResponse
    {
        $model = $this->service->update($building, $request->validated());

        return ApiResponse::success('Updated successfully.', new BuildingResource($model));
    }

    public function destroy(Building $building): JsonResponse
    {
        $this->service->archive($building);

        return ApiResponse::success('Archived successfully.');
    }
}

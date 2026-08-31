<?php

namespace App\Http\Controllers\Api;

use App\Domains\Organization\Resources\FloorResource;
use App\Domains\Organization\Requests\FloorRequest;
use App\Domains\Organization\Models\Floor;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FloorController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Organization\Models\Floor::class, 'Organization');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('organization.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', FloorResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(FloorRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new FloorResource($model), null, 201);
    }

    public function show(Floor $floor): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new FloorResource($floor));
    }

    public function update(FloorRequest $request, Floor $floor): JsonResponse
    {
        $model = $this->service->update($floor, $request->validated());

        return ApiResponse::success('Updated successfully.', new FloorResource($model));
    }

    public function destroy(Floor $floor): JsonResponse
    {
        $this->service->archive($floor);

        return ApiResponse::success('Archived successfully.');
    }
}

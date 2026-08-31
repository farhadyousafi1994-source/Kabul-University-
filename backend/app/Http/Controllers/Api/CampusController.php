<?php

namespace App\Http\Controllers\Api;

use App\Domains\Organization\Resources\CampusResource;
use App\Domains\Organization\Requests\CampusRequest;
use App\Domains\Organization\Models\Campus;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CampusController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Organization\Models\Campus::class, 'Organization');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('organization.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', CampusResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(CampusRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new CampusResource($model), null, 201);
    }

    public function show(Campus $campus): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new CampusResource($campus));
    }

    public function update(CampusRequest $request, Campus $campus): JsonResponse
    {
        $model = $this->service->update($campus, $request->validated());

        return ApiResponse::success('Updated successfully.', new CampusResource($model));
    }

    public function destroy(Campus $campus): JsonResponse
    {
        $this->service->archive($campus);

        return ApiResponse::success('Archived successfully.');
    }
}

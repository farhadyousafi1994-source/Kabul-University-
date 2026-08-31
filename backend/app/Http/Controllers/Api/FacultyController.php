<?php

namespace App\Http\Controllers\Api;

use App\Domains\Organization\Resources\FacultyResource;
use App\Domains\Organization\Requests\FacultyRequest;
use App\Domains\Organization\Models\Faculty;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FacultyController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Organization\Models\Faculty::class, 'Organization');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('organization.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', FacultyResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(FacultyRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new FacultyResource($model), null, 201);
    }

    public function show(Faculty $faculty): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new FacultyResource($faculty));
    }

    public function update(FacultyRequest $request, Faculty $faculty): JsonResponse
    {
        $model = $this->service->update($faculty, $request->validated());

        return ApiResponse::success('Updated successfully.', new FacultyResource($model));
    }

    public function destroy(Faculty $faculty): JsonResponse
    {
        $this->service->archive($faculty);

        return ApiResponse::success('Archived successfully.');
    }
}

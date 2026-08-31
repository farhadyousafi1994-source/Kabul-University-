<?php

namespace App\Http\Controllers\Api;

use App\Domains\Organization\Resources\DepartmentResource;
use App\Domains\Organization\Requests\DepartmentRequest;
use App\Domains\Organization\Models\Department;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Organization\Models\Department::class, 'Organization');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('organization.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', DepartmentResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(DepartmentRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new DepartmentResource($model), null, 201);
    }

    public function show(Department $department): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new DepartmentResource($department));
    }

    public function update(DepartmentRequest $request, Department $department): JsonResponse
    {
        $model = $this->service->update($department, $request->validated());

        return ApiResponse::success('Updated successfully.', new DepartmentResource($model));
    }

    public function destroy(Department $department): JsonResponse
    {
        $this->service->archive($department);

        return ApiResponse::success('Archived successfully.');
    }
}

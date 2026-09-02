<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetAssignment;
use App\Domains\Asset\Requests\AssignmentRequest;
use App\Domains\Asset\Requests\ReturnRequest;
use App\Domains\Asset\Resources\AssetAssignmentResource;
use App\Domains\Asset\Services\AssignmentService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 8 — Assignment & return.
 */
class AssignmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        AssignmentService::markOverdue();

        $query = AssetAssignment::query()
            ->with(['asset', 'employee.department', 'assignee', 'assigner'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('asset_id'), fn ($q, $v) => $q->where('asset_id', (int) $v))
            ->when($request->get('employee_id'), fn ($q, $v) => $q->where('employee_id', (int) $v))
            ->when($request->get('assigned_to_user_id'), fn ($q, $v) => $q->where('assigned_to_user_id', (int) $v))
            ->when($request->get('search'), function ($q, $search) {
                $q->whereHas('asset', fn ($a) => $a->where('name', 'like', "%{$search}%")->orWhere('asset_code', 'like', "%{$search}%"))
                    ->orWhereHas('employee', fn ($e) => $e->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('employee_code', 'like', "%{$search}%"))
                    ->orWhereHas('assignee', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Assignments retrieved successfully.', AssetAssignmentResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    /**
     * POST /api/assets/{asset}/assign
     */
    public function assign(AssignmentRequest $request, Asset $asset): JsonResponse
    {
        $assignment = AssignmentService::assign($asset, $request->validated());

        return ApiResponse::success('Asset assigned successfully.', new AssetAssignmentResource($assignment->load('asset', 'employee', 'assignee', 'assigner')), null, 201);
    }

    /**
     * POST /api/asset-assignments/{assignment}/return
     */
    public function returnAsset(ReturnRequest $request, AssetAssignment $assignment): JsonResponse
    {
        $assignment = AssignmentService::returnAsset($assignment, $request->validated());

        return ApiResponse::success('Asset returned successfully.', new AssetAssignmentResource($assignment->load('asset', 'employee', 'assignee', 'assigner')));
    }

    public function show(AssetAssignment $assignment): JsonResponse
    {
        return ApiResponse::success('Assignment retrieved successfully.', new AssetAssignmentResource($assignment->load('asset', 'employee', 'assignee', 'assigner')));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\HR\Models\Employee;
use App\Domains\HR\Requests\EmployeeRequest;
use App\Domains\HR\Resources\EmployeeResource;
use App\Domains\System\Services\ActivityLogService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Employees module — HR directory + Asset assignment overview.
 *
 * Employees are a dedicated entity, optionally linked to a user account.
 * Deleting an employee is refused while assets are still assigned to them
 * (safe strategy: unassign/reassign first), and assets are never deleted.
 */
class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $paginator = Employee::query()
            ->with(['department.faculty', 'manager', 'user'])
            ->withCount('assets')
            ->search($request->get('search'))
            ->filterDepartment($request->integer('department_id') ?: null)
            ->filterStatus($request->get('status'))
            ->filterEmploymentType($request->get('employment_type'))
            ->sort($request->get('sort'), $request->get('direction'))
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success(
            'Employees retrieved successfully.',
            EmployeeResource::collection($paginator),
            ApiResponse::paginationMeta($paginator),
        );
    }

    public function store(EmployeeRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (empty($data['employee_code'])) {
            $data['employee_code'] = Employee::nextCode();
        }

        $employee = DB::transaction(fn () => Employee::create($data));

        ActivityLogService::record('created', 'Employees', Employee::class, $employee->id, $employee->full_name, null, $employee->toArray());

        return ApiResponse::success(
            'Employee created successfully.',
            new EmployeeResource($employee->load(['department.faculty', 'manager', 'user'])->loadCount('assets')),
            null,
            201,
        );
    }

    public function show(Employee $employee): JsonResponse
    {
        $employee->load(['department.faculty', 'manager', 'user'])->loadCount('assets');

        $assets = $employee->assets()->get();
        $activeStatuses = [
            Asset::STATUS_AVAILABLE,
            Asset::STATUS_ASSIGNED,
            Asset::STATUS_RESERVED,
        ];

        $resource = new EmployeeResource($employee);
        $payload = $resource->resolve();
        $payload['asset_summary'] = [
            'total' => $assets->count(),
            'active' => $assets->whereIn('status', $activeStatuses)->count(),
            'under_maintenance' => $assets->where('status', Asset::STATUS_UNDER_MAINTENANCE)->count(),
            'total_value' => (float) $assets->sum('current_value'),
        ];

        return ApiResponse::success('Employee retrieved successfully.', $payload);
    }

    public function update(EmployeeRequest $request, Employee $employee): JsonResponse
    {
        $data = $request->validated();

        // Never blank out the code through an empty form field.
        if (array_key_exists('employee_code', $data) && ! $data['employee_code']) {
            unset($data['employee_code']);
        }

        DB::transaction(fn () => $employee->update($data));

        ActivityLogService::record('updated', 'Employees', Employee::class, $employee->id, $employee->full_name, null, $data);

        return ApiResponse::success(
            'Employee updated successfully.',
            new EmployeeResource($employee->fresh()->load(['department.faculty', 'manager', 'user'])->loadCount('assets')),
        );
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $assignedCount = $employee->assets()->count();

        if ($assignedCount > 0) {
            return ApiResponse::error(
                "This employee still has {$assignedCount} assigned asset(s). Unassign or reassign them before deleting the employee.",
                422,
                ['assets' => ['Employee has assigned assets.']],
            );
        }

        DB::transaction(fn () => $employee->delete());

        ActivityLogService::record('deleted', 'Employees', Employee::class, $employee->id, $employee->full_name);

        return ApiResponse::success('Employee archived successfully.');
    }

    /**
     * GET /employees/{employee}/assets — assets assigned to the employee.
     */
    public function assets(Employee $employee): JsonResponse
    {
        $assets = $employee->assets()
            ->with('category')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Asset $asset) => [
                'id' => $asset->id,
                'asset_code' => $asset->asset_code,
                'name' => $asset->name,
                'category_name' => $asset->category?->name,
                'serial_number' => $asset->serial_number,
                'status' => $asset->status,
                'condition' => $asset->condition,
                'current_value' => (float) $asset->current_value,
                'updated_at' => $asset->updated_at?->toIso8601String(),
            ]);

        return ApiResponse::success('Employee assets retrieved successfully.', ['data' => $assets]);
    }
}

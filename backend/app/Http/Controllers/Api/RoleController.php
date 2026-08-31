<?php

namespace App\Http\Controllers\Api;

use App\Domains\Security\Requests\RoleRequest;
use App\Domains\Security\Resources\RoleResource;
use App\Domains\Security\Services\RoleService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Module 3 — Roles & permissions.
 */
class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Role::with('permissions')
            ->withCount('users')
            ->when($request->get('search'), fn ($q, $s) => $q->where('name', 'like', "%{$s}%"));

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Roles retrieved successfully.', RoleResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function permissions(): JsonResponse
    {
        $all = Permission::orderBy('name')->get();

        $grouped = $all->groupBy(fn ($p) => explode('.', $p->name)[0])
            ->map(fn ($group) => $group->values()->map(fn ($p) => ['name' => $p->name]));

        return ApiResponse::success('Permissions retrieved successfully.', $grouped);
    }

    public function store(RoleRequest $request): JsonResponse
    {
        $role = RoleService::create($request->validated());

        return ApiResponse::success('Role created successfully.', new RoleResource($role), null, 201);
    }

    public function show(Role $role): JsonResponse
    {
        return ApiResponse::success('Role retrieved successfully.', new RoleResource($role->load('permissions')));
    }

    public function update(RoleRequest $request, Role $role): JsonResponse
    {
        $role = RoleService::update($role, $request->validated());

        return ApiResponse::success('Role updated successfully.', new RoleResource($role));
    }

    public function destroy(Role $role): JsonResponse
    {
        RoleService::delete($role);

        return ApiResponse::success('Role deleted successfully.');
    }
}

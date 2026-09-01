<?php

namespace App\Http\Controllers\Api;

use App\Domains\Security\Requests\UserRequest;
use App\Domains\Security\Services\UserService;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 3 — Users management.
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->with('roles.permissions', 'department')
            ->search($request->get('search'))
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('department_id'), fn ($q, $v) => $q->where('department_id', (int) $v))
            ->when($request->get('hire_type'), fn ($q, $v) => $q->where('hire_type', $v))
            ->when($request->get('role'), fn ($q, $r) => $q->role($r))
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Users retrieved successfully.', UserResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(UserRequest $request): JsonResponse
    {
        $user = UserService::create($request->validated());

        return ApiResponse::success('User created successfully.', new UserResource($user), null, 201);
    }

    public function show(User $user): JsonResponse
    {
        return ApiResponse::success('User retrieved successfully.', new UserResource($user->load('roles.permissions', 'department')));
    }

    public function update(UserRequest $request, User $user): JsonResponse
    {
        $user = UserService::update($user, $request->validated());

        return ApiResponse::success('User updated successfully.', new UserResource($user));
    }

    public function destroy(User $user): JsonResponse
    {
        UserService::delete($user);

        return ApiResponse::success('User deleted successfully.');
    }

    public function activate(User $user): JsonResponse
    {
        return ApiResponse::success('User activated successfully.', new UserResource(UserService::activate($user)->load('roles.permissions', 'department')));
    }

    public function deactivate(User $user): JsonResponse
    {
        return ApiResponse::success('User deactivated successfully.', new UserResource(UserService::deactivate($user)->load('roles.permissions', 'department')));
    }

    public function leave(User $user): JsonResponse
    {
        return ApiResponse::success('Employee marked as on leave.', new UserResource(UserService::leave($user)->load('roles.permissions', 'department')));
    }

    /**
     * Bulk-import employees from a CSV payload: { rows: [...] }.
     */
    public function bulk(Request $request): JsonResponse
    {
        $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.name' => ['required', 'string', 'max:255'],
            'rows.*.email' => ['required', 'string', 'max:255'],
            'rows.*.phone' => ['nullable', 'string', 'max:32'],
            'rows.*.department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'rows.*.position' => ['nullable', 'string', 'max:255'],
            'rows.*.hire_type' => ['sometimes', \Illuminate\Validation\Rule::in(['permanent', 'contract'])],
            'rows.*.salary' => ['sometimes', 'nullable', 'integer', 'min:0'],
        ]);

        [$created, $errors] = UserService::bulkImport($request->input('rows'));

        return ApiResponse::success('Bulk import finished.', [
            'created' => $created,
            'errors' => $errors,
        ], null, $errors && ! $created ? 422 : 200);
    }
}

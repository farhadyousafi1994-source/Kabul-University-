<?php

namespace App\Http\Controllers\Api;

use App\Domains\Organization\Resources\RoomResource;
use App\Domains\Organization\Requests\RoomRequest;
use App\Domains\Organization\Models\Room;

use App\Domains\Organization\Services\OrganizationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    public function __construct()
    {
        $this->service = new OrganizationService(\App\Domains\Organization\Models\Room::class, 'Organization');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('organization.view')) {
            return ApiResponse::error('You do not have permission to perform this action.', 403);
        }

        $paginator = $this->service->query($request->all())
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ApiResponse::success('List retrieved successfully.', RoomResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(RoomRequest $request): JsonResponse
    {
        $model = $this->service->create($request->validated());

        return ApiResponse::success('Created successfully.', new RoomResource($model), null, 201);
    }

    public function show(Room $room): JsonResponse
    {
        return ApiResponse::success('Retrieved successfully.', new RoomResource($room));
    }

    public function update(RoomRequest $request, Room $room): JsonResponse
    {
        $model = $this->service->update($room, $request->validated());

        return ApiResponse::success('Updated successfully.', new RoomResource($model));
    }

    public function destroy(Room $room): JsonResponse
    {
        $this->service->archive($room);

        return ApiResponse::success('Archived successfully.');
    }
}

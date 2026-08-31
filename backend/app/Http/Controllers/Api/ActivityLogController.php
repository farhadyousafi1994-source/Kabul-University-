<?php

namespace App\Http\Controllers\Api;

use App\Domains\System\Models\ActivityLog;
use App\Domains\System\Resources\ActivityLogResource;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 21 — Activity logs.
 */
class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::query()
            ->with('user')
            ->when($request->get('module'), fn ($q, $m) => $q->where('module', $m))
            ->when($request->get('action'), fn ($q, $a) => $q->where('action', $a))
            ->when($request->get('search'), function ($q, $s) {
                $q->where('entity_label', 'like', "%{$s}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Activity logs retrieved successfully.', ActivityLogResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }
}

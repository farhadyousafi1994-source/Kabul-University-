<?php

namespace App\Http\Controllers\Api;

use App\Domains\System\Resources\NotificationResource;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 20 — In-app notifications.
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->limit(50)
            ->get();

        return ApiResponse::success('Notifications retrieved successfully.', NotificationResource::collection($notifications));
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->whereKey($id)->update(['read_at' => now()]);

        return ApiResponse::success('Notification marked as read.');
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return ApiResponse::success('All notifications marked as read.');
    }
}

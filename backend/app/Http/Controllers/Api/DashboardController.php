<?php

namespace App\Http\Controllers\Api;

use App\Domains\System\Services\DashboardService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Module 22 — Dashboard & analytics.
 */
class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        return ApiResponse::success('Dashboard statistics retrieved successfully.', DashboardService::stats());
    }

    public function charts(): JsonResponse
    {
        return ApiResponse::success('Dashboard charts retrieved successfully.', DashboardService::charts());
    }

    public function recentActivities(): JsonResponse
    {
        return ApiResponse::success('Recent activities retrieved successfully.', ['data' => DashboardService::recentActivities()]);
    }

    public function upcoming(): JsonResponse
    {
        return ApiResponse::success('Upcoming events retrieved successfully.', DashboardService::upcoming());
    }
}

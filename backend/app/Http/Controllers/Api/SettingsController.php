<?php

namespace App\Http\Controllers\Api;

use App\Domains\System\Requests\SettingsRequest;
use App\Domains\System\Services\SettingsService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 24 — System settings.
 */
class SettingsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return ApiResponse::success('Settings retrieved successfully.', SettingsService::all());
    }

    public function update(SettingsRequest $request): JsonResponse
    {
        SettingsService::set($request->validated());

        return ApiResponse::success('Settings updated successfully.', SettingsService::all());
    }
}

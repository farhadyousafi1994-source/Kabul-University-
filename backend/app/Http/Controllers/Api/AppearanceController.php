<?php

namespace App\Http\Controllers\Api;

use App\Domains\System\Models\AppearanceDefault;
use App\Domains\System\Models\UserAppearance;
use App\Domains\System\Requests\AppearanceDefaultsRequest;
use App\Domains\System\Requests\AppearanceRequest;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\AppearanceService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Module 24b — Theme & Appearance.
 *
 *   GET    /api/appearance          the caller's preferences + org defaults + branding
 *   PUT    /api/appearance          persist the caller's preferences
 *   POST   /api/appearance/reset    delete them → fall back to the org default
 *   GET    /api/admin/appearance    organisation defaults + branding (admins)
 *   PUT    /api/admin/appearance    update organisation defaults + branding
 *
 * The browser cache is only a paint-speed optimisation; these endpoints are the
 * authoritative store, so a user's theme follows them across devices.
 * Mirrored 1:1 by frontend/mock-api/routes/appearance.routes.js.
 */
class AppearanceController extends Controller
{
    /**
     * Everything the theme store needs in a single round-trip on login.
     */
    public function index(): JsonResponse
    {
        $user = request()->user();
        $defaults = AppearanceService::defaults();

        return ApiResponse::success('Appearance preferences retrieved successfully.', [
            'user' => AppearanceService::serialise(AppearanceService::forUser($user)),
            'system' => AppearanceService::serialiseDefaults($defaults),
            'branding' => AppearanceService::branding($defaults),
            'can_manage_system' => AppearanceService::canManageSystem($user),
        ]);
    }

    public function update(AppearanceRequest $request): JsonResponse
    {
        $user = $request->user();
        $before = AppearanceService::serialise(AppearanceService::forUser($user));

        $appearance = AppearanceService::saveForUser($user, $request->preferences());

        ActivityLogService::record(
            'updated',
            'Appearance',
            UserAppearance::class,
            $user->id,
            sprintf('%s appearance', $user->name),
            $before,
            AppearanceService::serialise($appearance),
            $user->id,
        );

        return ApiResponse::success('Appearance preferences saved successfully.', [
            'user' => AppearanceService::serialise($appearance),
            'system' => AppearanceService::serialiseDefaults(AppearanceService::defaults()),
        ]);
    }

    /**
     * Clear the caller's overrides — they fall back to the organisation default.
     */
    public function reset(): JsonResponse
    {
        $user = request()->user();
        $before = AppearanceService::serialise(AppearanceService::forUser($user));

        AppearanceService::resetForUser($user);

        ActivityLogService::record(
            'reset',
            'Appearance',
            UserAppearance::class,
            $user->id,
            sprintf('%s appearance', $user->name),
            $before,
            null,
            $user->id,
        );

        return ApiResponse::success('Appearance preferences restored to the system default.', [
            'user' => null,
            'system' => AppearanceService::serialiseDefaults(AppearanceService::defaults()),
        ]);
    }

    /**
     * Organisation defaults (gated by `appearance.manage` in the route).
     */
    public function admin(): JsonResponse
    {
        $defaults = AppearanceService::defaults();

        return ApiResponse::success('System default appearance retrieved successfully.', [
            'defaults' => AppearanceService::serialiseDefaults($defaults),
            'branding' => AppearanceService::branding($defaults),
            'can_manage_system' => true,
        ]);
    }

    public function updateAdmin(AppearanceDefaultsRequest $request): JsonResponse
    {
        $user = $request->user();
        $before = AppearanceService::serialiseDefaults(AppearanceDefault::instance());

        $defaults = AppearanceService::saveDefaults($request->preferences(), $request->branding(), $user);

        ActivityLogService::record(
            'updated',
            'Appearance',
            AppearanceDefault::class,
            AppearanceDefault::SINGLETON_ID,
            'System default appearance',
            $before,
            AppearanceService::serialiseDefaults($defaults),
            $user->id,
        );

        return ApiResponse::success('System default appearance saved successfully.', [
            'defaults' => AppearanceService::serialiseDefaults($defaults),
            'branding' => AppearanceService::branding($defaults),
        ]);
    }
}

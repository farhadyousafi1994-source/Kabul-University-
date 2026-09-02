<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Resources\AssetResource;
use App\Domains\Asset\Requests\AssetRequest;
use App\Domains\Asset\Services\AssetService;
use App\Domains\System\Services\ActivityLogService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 6 — Core asset management.
 */
class AssetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Asset::query()
            ->with(['category', 'subcategory', 'supplier', 'campus', 'faculty', 'department', 'building', 'floor', 'room', 'employee'])
            ->withCount(['images', 'documents'])
            ->search($request->get('search'))
            ->filterStatus($request->get('status'))
            ->filterCondition($request->get('condition'))
            ->filterCategory($request->integer('category_id') ?: null)
            ->filterLocation('campus_id', $request->integer('campus_id') ?: null)
            ->filterLocation('faculty_id', $request->integer('faculty_id') ?: null)
            ->filterLocation('department_id', $request->integer('department_id') ?: null)
            ->filterLocation('building_id', $request->integer('building_id') ?: null)
            ->filterLocation('floor_id', $request->integer('floor_id') ?: null)
            ->filterLocation('room_id', $request->integer('room_id') ?: null)
            ->filterLocation('supplier_id', $request->integer('supplier_id') ?: null)
            ->filterLocation('employee_id', $request->integer('employee_id') ?: null);

        // Barcode / QR / asset-code lookup shortcut.
        if ($code = $request->get('code')) {
            $query->where(function ($q) use ($code) {
                $q->where('asset_code', $code)
                    ->orWhere('barcode', $code)
                    ->orWhere('qr_code', $code);
            });
        }

        $paginator = $query->sort($request->get('sort'), $request->get('direction'))
            ->paginate($request->integer('per_page', (int) \App\Domains\System\Services\SettingsService::get('pagination', 20)));

        return ApiResponse::success('Assets retrieved successfully.', AssetResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(AssetRequest $request): JsonResponse
    {
        $asset = AssetService::create($request->validated());

        return ApiResponse::success('Asset created successfully.', new AssetResource($asset->load('category', 'subcategory', 'supplier', 'campus', 'faculty', 'department', 'building', 'floor', 'room', 'employee')), null, 201);
    }

    public function show(Asset $asset): JsonResponse
    {
        return ApiResponse::success('Asset retrieved successfully.', new AssetResource($asset->load('category', 'subcategory', 'supplier', 'campus', 'faculty', 'department', 'building', 'floor', 'room', 'employee')->loadCount(['images', 'documents'])));
    }

    public function update(AssetRequest $request, Asset $asset): JsonResponse
    {
        $asset = AssetService::update($asset, $request->validated());

        return ApiResponse::success('Asset updated successfully.', new AssetResource($asset->load('category', 'subcategory', 'supplier', 'campus', 'faculty', 'department', 'building', 'floor', 'room', 'employee')));
    }

    public function destroy(Asset $asset): JsonResponse
    {
        AssetService::archive($asset);

        return ApiResponse::success('Asset archived successfully.');
    }

    /**
     * Asset timeline: location history + assignments + maintenance + transfers.
     */
    public function timeline(Asset $asset): JsonResponse
    {
        $timeline = collect()
            ->merge($asset->locationHistories()->with('mover')->get()->map(fn ($h) => [
                'date' => $h->moved_at?->toIso8601String(),
                'type' => 'location',
                'title' => 'Location change',
                'description' => ($h->reason ?? 'Moved').' — by '.($h->mover?->name ?? 'System'),
            ]))
            ->merge($asset->assignments()->with('employee')->get()->map(fn ($a) => [
                'date' => $a->assigned_date?->toIso8601String(),
                'type' => 'assignment',
                'title' => 'Assignment '.$a->status,
                'description' => 'Assigned to '.($a->employee?->full_name ?? ('user #'.$a->assigned_to_user_id)),
            ]))
            ->merge($asset->maintenanceRecords()->get()->map(fn ($m) => [
                'date' => ($m->end_date ?? $m->start_date ?? $m->created_at)?->toIso8601String(),
                'type' => 'maintenance',
                'title' => 'Maintenance '.$m->status,
                'description' => $m->maintenance_type.' — cost '.$m->cost,
            ]))
            ->merge($asset->transfers()->get()->map(fn ($t) => [
                'date' => $t->created_at?->toIso8601String(),
                'type' => 'transfer',
                'title' => 'Transfer '.$t->status,
                'description' => $t->notes ?? 'Asset transfer',
            ]))
            ->sortByDesc('date')
            ->values();

        return ApiResponse::success('Asset timeline retrieved successfully.', $timeline);
    }

    /**
     * Lookup an asset by QR code, barcode or asset code (scanning API).
     */
    public function lookup(Request $request): JsonResponse
    {
        $code = trim((string) $request->query('code', ''));

        if ($code === '') {
            return ApiResponse::error('A code is required.', 422);
        }

        $asset = Asset::query()
            ->with(['category', 'subcategory', 'supplier', 'campus', 'faculty', 'department', 'building', 'floor', 'room', 'activeAssignment.assignee'])
            ->where('asset_code', $code)
            ->orWhere('barcode', $code)
            ->orWhere('qr_code', $code)
            ->first();

        if (! $asset) {
            return ApiResponse::error('No asset found for this code.', 404);
        }

        return ApiResponse::success('Asset found.', new AssetResource($asset));
    }

    /**
     * Quick status change endpoint used by small workflow actions.
     */
    public function changeStatus(Request $request, Asset $asset): JsonResponse
    {
        $request->validate(['status' => ['required', 'string', 'in:'.implode(',', Asset::STATUSES)]]);

        $asset->update(['status' => $request->input('status')]);

        ActivityLogService::record('updated', 'Assets', Asset::class, $asset->id, $asset->name, null, ['status' => $request->input('status')]);

        return ApiResponse::success('Asset status updated successfully.', new AssetResource($asset->load('category')));
    }
}

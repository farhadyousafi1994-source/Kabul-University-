<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Audit\Models\AssetAudit;
use App\Domains\Audit\Requests\AuditRequest;
use App\Domains\Audit\Requests\VerifyRequest;
use App\Domains\Audit\Resources\AssetAuditResource;
use App\Domains\Audit\Services\AuditService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 14 — Asset audit & physical verification.
 */
class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AssetAudit::query()
            ->with(['auditor'])
            ->withCount('items')
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('search'), fn ($q, $s) => $q->where('audit_code', 'like', "%{$s}%"))
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Audits retrieved successfully.', AssetAuditResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(AuditRequest $request): JsonResponse
    {
        $audit = AuditService::create($request->validated());

        return ApiResponse::success('Audit created successfully.', new AssetAuditResource($audit->load('auditor', 'items')), null, 201);
    }

    public function show(AssetAudit $audit): JsonResponse
    {
        return ApiResponse::success('Audit retrieved successfully.', new AssetAuditResource($audit->load('auditor', 'items.asset.category', 'items.asset.room')));
    }

    public function start(AssetAudit $audit): JsonResponse
    {
        $audit = AuditService::start($audit);

        return ApiResponse::success('Audit started successfully.', new AssetAuditResource($audit->load('auditor', 'items')));
    }

    public function verify(VerifyRequest $request, AssetAudit $audit): JsonResponse
    {
        $item = AuditService::verify($audit, Asset::findOrFail($request->input('asset_id')), $request->input('verification'), $request->input('notes'));

        return ApiResponse::success('Asset verified successfully.', $item->load('asset'));
    }

    public function complete(AssetAudit $audit): JsonResponse
    {
        $audit = AuditService::complete($audit);

        return ApiResponse::success('Audit completed successfully.', new AssetAuditResource($audit->load('auditor', 'items')));
    }

    public function cancel(AssetAudit $audit): JsonResponse
    {
        $audit = AuditService::cancel($audit);

        return ApiResponse::success('Audit cancelled successfully.', new AssetAuditResource($audit));
    }
}

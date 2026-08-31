<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Financial\Models\AssetDepreciation;
use App\Domains\Financial\Resources\AssetDepreciationResource;
use App\Domains\Financial\Resources\DepreciationMethodResource;
use App\Domains\Financial\Services\DepreciationService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 18 — Depreciation.
 */
class DepreciationController extends Controller
{
    public function methods(): JsonResponse
    {
        return ApiResponse::success('Depreciation methods retrieved successfully.', DepreciationMethodResource::collection(\App\Domains\Financial\Models\DepreciationMethod::all()));
    }

    public function index(Request $request): JsonResponse
    {
        $query = AssetDepreciation::query()
            ->with(['asset', 'method'])
            ->when($request->get('asset_id'), fn ($q, $v) => $q->where('asset_id', (int) $v))
            ->when($request->get('period'), fn ($q, $p) => $q->where('period', $p))
            ->latest('period');

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Depreciation records retrieved successfully.', AssetDepreciationResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function calculate(Request $request): JsonResponse
    {
        $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'period' => ['sometimes', 'date_format:Y-m'],
        ]);

        $asset = Asset::findOrFail($request->input('asset_id'));
        $record = DepreciationService::calculateForAsset($asset, $request->input('period', now()->format('Y-m')));

        return ApiResponse::success('Depreciation calculated successfully.', new AssetDepreciationResource($record->load('asset', 'method')));
    }

    public function bookValue(Request $request, Asset $asset): JsonResponse
    {
        return ApiResponse::success('Book value retrieved successfully.', [
            'asset_id' => $asset->id,
            'book_value' => DepreciationService::bookValue($asset, $request->input('period', now()->format('Y-m'))),
            'annual_depreciation' => DepreciationService::annual($asset),
        ]);
    }

    public function runMonthly(): JsonResponse
    {
        $count = DepreciationService::runMonthly();

        return ApiResponse::success("Monthly depreciation calculated for {$count} assets.");
    }
}

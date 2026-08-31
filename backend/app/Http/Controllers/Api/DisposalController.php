<?php

namespace App\Http\Controllers\Api;

use App\Domains\Financial\Models\AssetDisposal;
use App\Domains\Financial\Requests\DisposalRequest;
use App\Domains\Financial\Resources\AssetDisposalResource;
use App\Domains\Financial\Services\DisposalService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module 19 — Asset disposal & retirement.
 */
class DisposalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AssetDisposal::query()
            ->with(['asset', 'requester', 'approver'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('method'), fn ($q, $m) => $q->where('method', $m))
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Disposals retrieved successfully.', AssetDisposalResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(DisposalRequest $request): JsonResponse
    {
        $disposal = DisposalService::request($request->validated());

        return ApiResponse::success('Disposal request created successfully.', new AssetDisposalResource($disposal->load('asset', 'requester')), null, 201);
    }

    public function inspect(Request $request, AssetDisposal $disposal): JsonResponse
    {
        $request->validate(['notes' => ['nullable', 'string']]);
        $disposal = DisposalService::inspect($disposal, $request->input('notes'));

        return ApiResponse::success('Disposal inspection recorded successfully.', new AssetDisposalResource($disposal->load('asset')));
    }

    public function approve(Request $request, AssetDisposal $disposal): JsonResponse
    {
        $disposal = DisposalService::approve($disposal, (bool) $request->input('approve', true));

        return ApiResponse::success('Disposal updated successfully.', new AssetDisposalResource($disposal->load('asset', 'approver')));
    }

    public function execute(Request $request, AssetDisposal $disposal): JsonResponse
    {
        $request->validate([
            'revenue' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $disposal = DisposalService::execute($disposal, $request->float('revenue'), $request->input('notes'));

        return ApiResponse::success('Disposal executed successfully.', new AssetDisposalResource($disposal->load('asset', 'approver')));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Domains\Maintenance\Models\AssetIncident;
use App\Domains\Maintenance\Requests\IncidentRequest;
use App\Domains\Maintenance\Resources\AssetIncidentResource;
use App\Domains\Maintenance\Services\IncidentService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Module 12 — Asset incidents.
 */
class IncidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AssetIncident::query()
            ->with(['asset', 'reporter'])
            ->when($request->get('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->get('incident_type'), fn ($q, $t) => $q->where('incident_type', $t))
            ->when($request->get('search'), function ($q, $search) {
                $q->whereHas('asset', fn ($a) => $a->where('name', 'like', "%{$search}%")->orWhere('asset_code', 'like', "%{$search}%"));
            })
            ->latest();

        $paginator = $query->paginate($request->integer('per_page', 20));

        return ApiResponse::success('Incidents retrieved successfully.', AssetIncidentResource::collection($paginator), ApiResponse::paginationMeta($paginator));
    }

    public function store(IncidentRequest $request): JsonResponse
    {
        $incident = IncidentService::report($request->validated());

        return ApiResponse::success('Incident reported successfully.', new AssetIncidentResource($incident->load('asset', 'reporter')), null, 201);
    }

    public function updateStatus(Request $request, AssetIncident $incident): JsonResponse
    {
        $request->validate([
            'status' => ['required', Rule::in(AssetIncident::STATUSES)],
            'resolution' => ['nullable', 'string'],
        ]);

        $incident = IncidentService::updateStatus($incident, $request->input('status'), $request->input('resolution'));

        return ApiResponse::success('Incident updated successfully.', new AssetIncidentResource($incident->load('asset', 'reporter')));
    }
}

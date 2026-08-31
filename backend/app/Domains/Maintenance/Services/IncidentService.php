<?php

namespace App\Domains\Maintenance\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Maintenance\Models\AssetIncident;
use App\Domains\System\Services\ActivityLogService;

/**
 * Module 12 — Asset incident management.
 * Incident types: damaged, lost, stolen, destroyed.
 * Asset status is updated to match the incident type (lost/stolen/damaged).
 */
class IncidentService
{
    public static function report(array $data, ?int $reporterId = null): AssetIncident
    {
        $reporterId ??= auth('sanctum')->id();

        $incident = AssetIncident::create([
            'asset_id' => $data['asset_id'],
            'incident_type' => $data['incident_type'],
            'description' => $data['description'],
            'incident_date' => $data['incident_date'] ?? now()->toDateString(),
            'reported_by' => $reporterId,
            'status' => AssetIncident::STATUS_OPEN,
        ]);

        $assetStatus = match ($incident->incident_type) {
            AssetIncident::TYPE_LOST => Asset::STATUS_LOST,
            AssetIncident::TYPE_STOLEN => Asset::STATUS_STOLEN,
            AssetIncident::TYPE_DESTROYED => Asset::STATUS_DISPOSED,
            default => Asset::STATUS_DAMAGED,
        };

        $incident->asset()->update(['status' => $assetStatus]);

        ActivityLogService::record('incident', 'Incidents', Asset::class, $incident->asset_id, $incident->asset?->name, null, $data, $reporterId);

        return $incident;
    }

    public static function updateStatus(AssetIncident $incident, string $status, ?string $resolution = null): AssetIncident
    {
        $incident->update([
            'status' => $status,
            'resolution' => $resolution ?? $incident->resolution,
        ]);

        ActivityLogService::record('updated', 'Incidents', AssetIncident::class, $incident->id, $incident->asset?->name, null, [
            'status' => $status,
            'resolution' => $resolution,
        ]);

        // Resolving an incident restores a usable asset to available.
        if (in_array($status, [AssetIncident::STATUS_RESOLVED, AssetIncident::STATUS_CLOSED], true)
            && in_array($incident->incident_type, [AssetIncident::TYPE_DAMAGED], true)) {
            $incident->asset()->update(['status' => Asset::STATUS_AVAILABLE]);
        }

        return $incident->fresh();
    }
}

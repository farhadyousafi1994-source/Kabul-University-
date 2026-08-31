<?php

namespace App\Console\Commands;

use App\Domains\Asset\Models\Asset;
use App\Domains\Maintenance\Models\AssetMaintenance;
use App\Domains\System\Services\NotificationService;
use Illuminate\Console\Command;

class SendMaintenanceNotifications extends Command
{
    protected $signature = 'notify:maintenance {--days=30 : warranty expiry window in days}';

    protected $description = 'Notify about expiring warranties and upcoming scheduled maintenance';

    public function handle(): int
    {
        $days = (int) $this->option('days');

        // Expiring warranties
        $assets = Asset::whereNotNull('warranty_expiry_date')
            ->where('warranty_expiry_date', '<=', now()->addDays($days)->toDateString())
            ->where('warranty_expiry_date', '>=', now()->toDateString())
            ->whereNotIn('status', [Asset::STATUS_DISPOSED])
            ->get();

        foreach ($assets as $asset) {
            $notified = (bool) \App\Domains\System\Models\ActivityLog::where('module', 'Notifications')
                ->where('entity_id', $asset->id)
                ->where('action', 'warranty_expiring')
                ->whereDate('created_at', today())
                ->exists();

            if ($notified) {
                continue;
            }

            NotificationService::send(
                (int) ($asset->created_by ?? 1),
                'warranty_expiring',
                'Warranty expiring soon',
                "Warranty of {$asset->name} ({$asset->asset_code}) expires on {$asset->warranty_expiry_date->toDateString()}.",
                'verified_user',
            );

            \App\Domains\System\Services\ActivityLogService::record(
                'warranty_expiring',
                'Notifications',
                Asset::class,
                $asset->id,
                $asset->name,
            );
        }

        // Upcoming scheduled maintenance
        $scheduled = AssetMaintenance::whereIn('status', ['requested', 'approved', 'assigned'])
            ->whereNotNull('scheduled_date')
            ->where('scheduled_date', '<=', now()->addDays(7)->toDateString())
            ->get();

        foreach ($scheduled as $maintenance) {
            NotificationService::send(
                (int) ($maintenance->technician_id ?? $maintenance->asset?->created_by ?? 1),
                'maintenance_required',
                'Maintenance scheduled',
                "{$maintenance->maintenance_type} maintenance for {$maintenance->asset?->name} is due {$maintenance->scheduled_date?->toDateString()}.",
                'event_available',
            );
        }

        $this->info("Notified about {$assets->count()} expiring warranties and {$scheduled->count()} scheduled maintenance jobs.");

        return self::SUCCESS;
    }
}

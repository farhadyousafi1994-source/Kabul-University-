<?php

namespace App\Domains\System\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Maintenance\Models\AssetMaintenance;
use App\Domains\System\Models\ActivityLog;
use Illuminate\Support\Carbon;

/**
 * Module 22 — Dashboard & analytics.
 */
class DashboardService
{
    public static function stats(): array
    {
        $count = fn (string $status) => Asset::where('status', $status)->count();

        $purchase = (float) Asset::sum('purchase_price');
        $current = (float) Asset::sum('current_value');

        return [
            'total_assets' => Asset::count(),
            'available_assets' => $count(Asset::STATUS_AVAILABLE),
            'assigned_assets' => $count(Asset::STATUS_ASSIGNED),
            'reserved_assets' => $count(Asset::STATUS_RESERVED),
            'under_maintenance' => $count(Asset::STATUS_UNDER_MAINTENANCE),
            'damaged_assets' => $count(Asset::STATUS_DAMAGED),
            'lost_assets' => $count(Asset::STATUS_LOST),
            'stolen_assets' => $count(Asset::STATUS_STOLEN),
            'disposed_assets' => $count(Asset::STATUS_DISPOSED),
            'retired_assets' => $count(Asset::STATUS_RETIRED),
            'total_users' => \App\Models\User::count(),
            'total_suppliers' => \App\Domains\Procurement\Models\Supplier::count(),
            'open_maintenance' => AssetMaintenance::whereIn('status', ['requested', 'approved', 'assigned', 'in_progress'])->count(),
            'expiring_warranties' => Asset::whereNotNull('warranty_expiry_date')
                ->where('warranty_expiry_date', '<=', now()->addDays(90)->toDateString())
                ->whereNotIn('status', [Asset::STATUS_DISPOSED])
                ->count(),
            'total_purchase_value' => (int) round($purchase),
            'current_value' => (int) round($current),
            'depreciated_value' => (int) round($purchase - $current),
        ];
    }

    public static function charts(): array
    {
        return [
            'by_category' => AssetCategory::withCount('assets')
                ->get()
                ->map(fn ($category) => [
                    'label' => $category->name,
                    'value' => $category->assets_count,
                ])
                ->values(),
            'by_status' => Asset::selectRaw('status as label, COUNT(*) as value')
                ->groupBy('status')
                ->get()
                ->map(fn ($row) => [
                    'label' => str_replace('_', ' ', $row->label),
                    'value' => $row->value,
                ]),
            'acquisitions' => collect(range(11, 0))->map(function ($i) {
                $month = now()->startOfMonth()->subMonths($i);

                return [
                    'label' => $month->format('M y'),
                    'value' => Asset::whereYear('purchase_date', $month->year)
                        ->whereMonth('purchase_date', $month->month)
                        ->count(),
                ];
            }),
            'maintenance_costs' => collect(range(5, 0))->map(function ($i) {
                $month = now()->startOfMonth()->subMonths($i);

                return [
                    'label' => $month->format('M'),
                    'value' => (int) round((float) AssetMaintenance::where('status', 'completed')
                        ->whereYear('end_date', $month->year)
                        ->whereMonth('end_date', $month->month)
                        ->sum('cost')),
                ];
            }),
        ];
    }

    public static function recentActivities(int $limit = 8): array
    {
        return ActivityLog::with('user')
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($log) => [
                'id' => $log->id,
                'user_name' => $log->user?->name ?? 'System',
                'action' => $log->action,
                'module' => $log->module,
                'entity_label' => $log->entity_label,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->all();
    }

    public static function upcoming(): array
    {
        $today = now()->toDateString();

        return [
            'maintenance' => AssetMaintenance::with('asset')
                ->whereIn('status', ['requested', 'approved', 'assigned'])
                ->whereNotNull('scheduled_date')
                ->orderBy('scheduled_date')
                ->limit(6)
                ->get()
                ->map(fn ($m) => [
                    'id' => $m->id,
                    'asset_name' => $m->asset?->name,
                    'maintenance_type' => $m->maintenance_type,
                    'scheduled_date' => $m->scheduled_date?->toDateString(),
                    'status' => $m->status,
                ]),
            'warranties' => Asset::whereNotNull('warranty_expiry_date')
                ->whereBetween('warranty_expiry_date', [$today, Carbon::now()->addDays(90)->toDateString()])
                ->whereNotIn('status', [Asset::STATUS_DISPOSED])
                ->orderBy('warranty_expiry_date')
                ->limit(6)
                ->get()
                ->map(fn ($asset) => [
                    'id' => $asset->id,
                    'asset_name' => $asset->name,
                    'warranty_expiry_date' => $asset->warranty_expiry_date?->toDateString(),
                ]),
        ];
    }
}

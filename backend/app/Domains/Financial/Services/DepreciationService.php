<?php

namespace App\Domains\Financial\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Financial\Models\AssetDepreciation;
use App\Domains\Financial\Models\DepreciationMethod;
use App\Domains\System\Services\ActivityLogService;
use Illuminate\Support\Facades\DB;

/**
 * Module 18 — Depreciation.
 *
 * Straight Line (default):
 *   Annual Depreciation = (Purchase Price - Salvage Value) / Useful Life
 *
 * Future-ready: the method lookup is keyed by code so Declining Balance and
 * Units of Production can be added by implementing their calculators.
 */
class DepreciationService
{
    public static function method(): DepreciationMethod
    {
        return DepreciationMethod::where('code', DepreciationMethod::CODE_STRAIGHT_LINE)->first()
            ?? DepreciationMethod::firstOrCreate(
                ['code' => DepreciationMethod::CODE_STRAIGHT_LINE],
                [
                    'name' => 'Straight Line',
                    'formula' => '(Purchase Price - Salvage Value) / Useful Life',
                ],
            );
    }

    /**
     * Annual depreciation amount (straight line).
     */
    public static function annual(Asset $asset): float
    {
        $salvage = (float) $asset->salvage_value;
        $life = max(1, (int) $asset->useful_life);

        return max(0, ((float) $asset->purchase_price - $salvage) / $life);
    }

    /**
     * Calculate the book value of an asset at a given period.
     */
    public static function bookValue(Asset $asset, string $period = null): float
    {
        $period ??= now()->format('Y-m');
        $annual = self::annual($asset);

        // Months elapsed since purchase (clamped to useful life).
        $months = 0;
        if ($asset->purchase_date) {
            $months = $asset->purchase_date->diffInMonths(\Carbon\Carbon::parse($period.'-01'));
        }
        $months = max(0, min($months, (int) $asset->useful_life * 12));

        return max((float) $asset->salvage_value, round((float) $asset->purchase_price - $annual * ($months / 12), 2));
    }

    /**
     * Generate (or refresh) the depreciation row for an asset and period.
     */
    public static function calculateForAsset(Asset $asset, string $period): AssetDepreciation
    {
        $annual = self::annual($asset);
        $method = self::method();

        $months = 0;
        if ($asset->purchase_date) {
            $months = $asset->purchase_date->diffInMonths(\Carbon\Carbon::parse($period.'-01'));
        }
        $months = max(0, $months);

        $accumulated = $annual * ($months / 12);
        $bookValue = max((float) $asset->salvage_value, round((float) $asset->purchase_price - $accumulated, 2));

        return AssetDepreciation::updateOrCreate(
            ['asset_id' => $asset->id, 'period' => $period],
            [
                'method_id' => $method->id,
                'original_value' => (float) $asset->purchase_price,
                'salvage_value' => (float) $asset->salvage_value,
                'useful_life' => (int) $asset->useful_life,
                'annual_depreciation' => round($annual, 2),
                'accumulated_depreciation' => round($accumulated, 2),
                'book_value' => $bookValue,
            ],
        );
    }

    /**
     * Run the monthly depreciation batch for all non-disposed assets.
     * Called by the scheduler (`asset:depreciate`).
     */
    public static function runMonthly(?string $period = null): int
    {
        $period ??= now()->format('Y-m');

        $assets = Asset::whereNotIn('status', [Asset::STATUS_DISPOSED, Asset::STATUS_RETIRED])
            ->whereNotNull('purchase_date')
            ->get();

        DB::transaction(function () use ($assets, $period) {
            foreach ($assets as $asset) {
                self::calculateForAsset($asset, $period);
                $asset->update(['current_value' => self::bookValue($asset, $period)]);
            }
        });

        ActivityLogService::record('calculated', 'Depreciation', null, null, "Monthly depreciation {$period}", null, [
            'assets' => $assets->count(),
        ]);

        return $assets->count();
    }
}

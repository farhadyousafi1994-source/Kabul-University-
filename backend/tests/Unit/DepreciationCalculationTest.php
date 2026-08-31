<?php

namespace Tests\Unit;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Financial\Services\DepreciationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepreciationCalculationTest extends TestCase
{
    use RefreshDatabase;

    private function makeAsset(array $overrides = []): Asset
    {
        $category = AssetCategory::create(['code' => 'EQP', 'name' => 'Equipment', 'status' => 'active']);

        return Asset::create(array_merge([
            'name' => 'Machine',
            'asset_code' => 'KU-EQP-2026-000001',
            'category_id' => $category->id,
            'purchase_date' => '2025-01-01',
            'purchase_price' => 12000,
            'salvage_value' => 2000,
            'useful_life' => 5,
            'status' => 'available',
            'condition' => 'good',
        ], $overrides));
    }

    public function test_annual_straight_line_depreciation(): void
    {
        $asset = $this->makeAsset();

        // (12000 - 2000) / 5 = 2000 per year.
        $this->assertSame(2000.0, DepreciationService::annual($asset));
    }

    public function test_book_value_after_one_year(): void
    {
        $asset = $this->makeAsset();

        // 12 months elapsed → accumulated 2000 → book value 10000.
        $this->assertSame(10000.0, DepreciationService::bookValue($asset, '2026-01'));
    }

    public function test_book_value_floors_at_salvage_value(): void
    {
        $asset = $this->makeAsset(['purchase_date' => '2010-01-01']);

        // Past useful life → book value cannot go below salvage value.
        $this->assertSame(2000.0, DepreciationService::bookValue($asset, now()->format('Y-m')));
    }

    public function test_zero_annual_depreciation_when_salvage_equals_price(): void
    {
        $asset = $this->makeAsset(['salvage_value' => 12000]);

        $this->assertSame(0.0, DepreciationService::annual($asset));
    }

    public function test_useful_life_is_never_zero(): void
    {
        $asset = $this->makeAsset(['useful_life' => 0]);

        // Guards against division by zero.
        $this->assertSame(10000.0, DepreciationService::annual($asset));
    }
}

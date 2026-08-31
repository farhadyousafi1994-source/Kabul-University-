<?php

namespace Tests\Feature;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Financial\Models\AssetDepreciation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

class DepreciationTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    private Asset $asset;

    protected function setUp(): void
    {
        parent::setUp();

        $category = AssetCategory::create(['code' => 'EQP', 'name' => 'Equipment', 'status' => 'active']);

        $this->asset = Asset::create([
            'name' => 'UPS Unit',
            'asset_code' => 'KU-EQP-2026-000001',
            'category_id' => $category->id,
            'purchase_date' => now()->subMonths(12)->toDateString(),
            'purchase_price' => 12000,
            'salvage_value' => 2000,
            'current_value' => 12000,
            'useful_life' => 5,
            'status' => 'available',
            'condition' => 'good',
        ]);
    }

    public function test_depreciation_command_creates_records(): void
    {
        $period = now()->format('Y-m');

        $this->artisan('asset:depreciate', ['--period' => $period])
            ->expectsOutputToContain('Monthly depreciation calculated for 1 assets')
            ->assertExitCode(0);

        $this->assertDatabaseHas('asset_depreciations', [
            'asset_id' => $this->asset->id,
            'period' => $period,
        ]);

        // Annual = (12000 - 2000) / 5 = 2000. Accumulated after 12 months = 2000.
        $record = AssetDepreciation::where('asset_id', $this->asset->id)->first();
        $this->assertSame(2000.0, (float) $record->annual_depreciation);
        $this->assertSame(2000.0, (float) $record->accumulated_depreciation);
        $this->assertSame(10000.0, (float) $record->book_value);

        // The asset's current value is updated to the book value.
        $this->assertSame(10000.0, (float) $this->asset->fresh()->current_value);
    }

    public function test_disposed_assets_are_excluded_from_depreciation(): void
    {
        $disposed = Asset::create([
            'name' => 'Old Server',
            'asset_code' => 'KU-EQP-2026-000002',
            'category_id' => $this->asset->category_id,
            'purchase_date' => now()->subMonths(12)->toDateString(),
            'purchase_price' => 50000,
            'salvage_value' => 0,
            'useful_life' => 5,
            'status' => 'disposed',
            'condition' => 'poor',
        ]);

        $this->artisan('asset:depreciate', ['--period' => now()->format('Y-m')])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('asset_depreciations', ['asset_id' => $disposed->id]);
    }

    public function test_book_value_endpoint(): void
    {
        $this->actingAsUserWithPermissions(['depreciation.view']);

        $this->getJson("/api/assets/{$this->asset->id}/book-value")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.asset_id', $this->asset->id)
            ->assertJsonPath('data.annual_depreciation', 2000);
    }

    public function test_depreciation_calculate_endpoint(): void
    {
        $this->actingAsUserWithPermissions(['depreciation.view', 'depreciation.calculate']);

        $this->postJson('/api/depreciations/calculate', [
            'asset_id' => $this->asset->id,
            'period' => now()->format('Y-m'),
        ])->assertStatus(200)
            ->assertJsonPath('data.asset_id', $this->asset->id);
    }
}

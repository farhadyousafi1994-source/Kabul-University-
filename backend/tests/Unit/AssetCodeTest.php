<?php

namespace Tests\Unit;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Asset\Services\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssetCodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_code_format_uses_category_year_and_sequence(): void
    {
        $category = AssetCategory::create(['code' => 'IT', 'name' => 'IT Equipment', 'status' => 'active']);

        $first = AssetService::generateCode($category);
        $second = AssetService::generateCode($category);

        $this->assertSame('KU-IT-'.now()->format('Y').'-000001', $first);
        $this->assertSame('KU-IT-'.now()->format('Y').'-000002', $second);
    }

    public function test_code_sequence_increments_across_existing_assets(): void
    {
        $category = AssetCategory::create(['code' => 'LAB', 'name' => 'Lab Equipment', 'status' => 'active']);

        Asset::create([
            'name' => 'Existing',
            'asset_code' => 'KU-LAB-'.now()->format('Y').'-000007',
            'category_id' => $category->id,
            'status' => 'available',
            'condition' => 'good',
        ]);

        $this->assertSame('KU-LAB-'.now()->format('Y').'-000008', AssetService::generateCode($category));
    }

    public function test_category_code_prefix_falls_back_to_name(): void
    {
        $category = AssetCategory::create(['code' => 'CAT-VEH', 'name' => 'Vehicles', 'status' => 'active']);

        // 'CAT-' prefix is stripped, so the code uses VEH.
        $this->assertSame('KU-VEH-'.now()->format('Y').'-000001', AssetService::generateCode($category));
    }
}

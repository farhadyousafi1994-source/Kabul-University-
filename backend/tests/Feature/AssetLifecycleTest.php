<?php

namespace Tests\Feature;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetAssignment;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Asset\Models\AssetTransfer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

class AssetLifecycleTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    private AssetCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = AssetCategory::create([
            'code' => 'IT',
            'name' => 'IT Equipment',
            'status' => 'active',
        ]);
    }

    public function test_asset_create_assign_return_transfer_lifecycle(): void
    {
        $this->actingAsUserWithPermissions([
            'assets.view', 'assets.create', 'assets.assign', 'assets.return', 'assets.transfer', 'assets.update',
        ]);

        $assignee = User::factory()->create(['username' => 'assignee', 'status' => 'active']);

        // 1. Create
        $response = $this->postJson('/api/assets', [
            'name' => 'Dell Latitude 5440',
            'category_id' => $this->category->id,
            'brand' => 'Dell',
            'model' => 'Latitude 5440',
            'serial_number' => 'SN-0001',
            'purchase_date' => '2026-01-15',
            'purchase_price' => 1200,
            'current_value' => 1200,
            'useful_life' => 5,
            'condition' => 'excellent',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Dell Latitude 5440')
            ->assertJsonPath('data.status', 'available');

        $assetId = $response->json('data.id');
        $asset = Asset::findOrFail($assetId);

        // Asset code follows the KU-{CATEGORY}-{YEAR}-{NUMBER} format.
        $this->assertMatchesRegularExpression('/^KU-IT-\d{4}-\d{6}$/', $asset->asset_code);
        $this->assertNotNull($asset->barcode);
        $this->assertNotNull($asset->qr_code);

        // Location history is recorded on creation.
        $this->assertDatabaseHas('asset_location_histories', ['asset_id' => $assetId, 'reason' => 'Initial registration']);

        // 2. Assign
        $this->postJson("/api/assets/{$assetId}/assign", [
            'assigned_to_user_id' => $assignee->id,
            'expected_return_date' => now()->addDays(30)->toDateString(),
            'notes' => 'Lab use',
        ])->assertStatus(201)
            ->assertJsonPath('data.asset_id', $assetId)
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('assets', ['id' => $assetId, 'status' => 'assigned']);
        $this->assertDatabaseHas('asset_assignments', [
            'asset_id' => $assetId, 'assigned_to_user_id' => $assignee->id, 'status' => 'active',
        ]);

        // Double assignment is rejected.
        $this->postJson("/api/assets/{$assetId}/assign", ['assigned_to_user_id' => $assignee->id])
            ->assertStatus(422);

        // 3. Return
        $assignmentId = AssetAssignment::where('asset_id', $assetId)->first()->id;

        $this->postJson("/api/asset-assignments/{$assignmentId}/return", [
            'condition_on_return' => 'good',
            'notes' => 'Returned after lab semester',
        ])->assertStatus(200)
            ->assertJsonPath('data.status', 'returned');

        $this->assertDatabaseHas('assets', ['id' => $assetId, 'status' => 'available', 'condition' => 'good']);

        // 4. Transfer
        $campus = \App\Domains\Organization\Models\Campus::create([
            'code' => 'CAMP-2', 'name' => 'Second Campus', 'status' => 'active',
        ]);

        $this->postJson("/api/assets/{$assetId}/transfers", [
            'to_campus_id' => $campus->id,
            'notes' => 'Moving to new lab',
        ])->assertStatus(201)
            ->assertJsonPath('data.status', 'requested');

        $transferId = AssetTransfer::where('asset_id', $assetId)->first()->id;

        $this->patchJson("/api/transfers/{$transferId}/status", ['status' => 'approved'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        $this->patchJson("/api/transfers/{$transferId}/status", ['status' => 'in_transit'])
            ->assertStatus(200);

        $this->patchJson("/api/transfers/{$transferId}/status", ['status' => 'completed'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        // Location history grew after the transfer completed.
        $this->assertDatabaseCount('asset_location_histories', 2);
    }

    public function test_asset_validation_errors(): void
    {
        $this->actingAsUserWithPermissions(['assets.view', 'assets.create']);

        $this->postJson('/api/assets', ['name' => 'No category'])
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['category_id']]);

        // Duplicate serial numbers are rejected.
        Asset::create([
            'name' => 'First',
            'asset_code' => 'KU-IT-2026-000001',
            'category_id' => $this->category->id,
            'serial_number' => 'DUP-SN',
            'status' => 'available',
            'condition' => 'excellent',
        ]);

        $this->postJson('/api/assets', [
            'name' => 'Second',
            'category_id' => $this->category->id,
            'serial_number' => 'DUP-SN',
        ])->assertStatus(422)
            ->assertJsonStructure(['errors' => ['serial_number']]);
    }

    public function test_asset_soft_delete_keeps_history(): void
    {
        $this->actingAsUserWithPermissions(['assets.view', 'assets.create', 'assets.delete']);

        $asset = Asset::create([
            'name' => 'Old Projector',
            'asset_code' => 'KU-IT-2026-000002',
            'category_id' => $this->category->id,
            'status' => 'available',
            'condition' => 'fair',
        ]);

        $this->deleteJson("/api/assets/{$asset->id}")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('assets', ['id' => $asset->id]);
    }

    public function test_disposed_asset_is_immutable(): void
    {
        $this->actingAsUserWithPermissions([
            'assets.view', 'assets.assign', 'assets.dispose',
        ]);

        $asset = Asset::create([
            'name' => 'EOL Laptop',
            'asset_code' => 'KU-IT-2026-000003',
            'category_id' => $this->category->id,
            'status' => 'available',
            'condition' => 'poor',
        ]);

        // Disposal workflow: request → inspect → approve → execute.
        $disposal = $this->postJson('/api/disposals', [
            'asset_id' => $asset->id,
            'method' => 'recycled',
            'notes' => 'End of life',
        ])->assertStatus(201)->json('data');

        $this->postJson("/api/disposals/{$disposal['id']}/inspect", ['notes' => 'Inspection done'])
            ->assertStatus(200);

        $this->postJson("/api/disposals/{$disposal['id']}/approve", ['approve' => true])
            ->assertStatus(200);

        $this->postJson("/api/disposals/{$disposal['id']}/execute", ['revenue' => 100])
            ->assertStatus(200);

        $this->assertDatabaseHas('assets', [
            'id' => $asset->id,
            'status' => 'disposed',
            'current_value' => 0,
        ]);

        // Disposed assets can never be assigned again.
        $assignee = User::factory()->create(['username' => 'someone', 'status' => 'active']);
        $this->postJson("/api/assets/{$asset->id}/assign", ['assigned_to_user_id' => $assignee->id])
            ->assertStatus(422);

        // ... and are never hard-deleted: the row (and history) survives.
        $this->assertDatabaseHas('assets', ['id' => $asset->id, 'status' => 'disposed']);
        $this->assertNull(Asset::find($asset->id)->deleted_at);
    }

    public function test_asset_request_workflow(): void
    {
        $this->actingAsUserWithPermissions([
            'requests.view', 'requests.create', 'requests.approve',
        ]);

        // Create
        $response = $this->postJson('/api/asset-requests', [
            'request_type' => 'new_asset',
            'asset_category_id' => $this->category->id,
            'quantity' => 2,
            'reason' => 'New lab computers needed',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'draft');

        $requestId = $response->json('data.id');
        $this->assertStringStartsWith('ARQ-', $response->json('data.request_number'));

        // Submit
        $this->postJson("/api/asset-requests/{$requestId}/submit")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'department_approval');

        // Department approval → manager review
        $this->postJson("/api/asset-requests/{$requestId}/department-approve", ['approve' => true])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'manager_review');

        // Manager approval → approved
        $this->postJson("/api/asset-requests/{$requestId}/manager-approve", ['approve' => true])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        // Complete
        $this->postJson("/api/asset-requests/{$requestId}/complete")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        // A completed request cannot be re-submitted.
        $this->postJson("/api/asset-requests/{$requestId}/submit")
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['status']]);
    }

    public function test_lookup_by_code_returns_matching_asset(): void
    {
        $this->actingAsUserWithPermissions(['assets.view']);

        $asset = Asset::create([
            'name' => 'Scanner',
            'asset_code' => 'KU-IT-2026-000004',
            'category_id' => $this->category->id,
            'status' => 'available',
            'condition' => 'good',
        ]);

        $this->getJson('/api/assets/lookup?code=KU-IT-2026-000004')
            ->assertStatus(200)
            ->assertJsonPath('data.id', $asset->id);
    }
}

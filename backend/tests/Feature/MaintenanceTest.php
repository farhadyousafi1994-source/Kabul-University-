<?php

namespace Tests\Feature;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Maintenance\Models\AssetMaintenance;
use App\Domains\Maintenance\Models\MaintenanceRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

class MaintenanceTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    private Asset $asset;

    protected function setUp(): void
    {
        parent::setUp();

        $category = AssetCategory::create(['code' => 'MACH', 'name' => 'Machinery', 'status' => 'active']);

        $this->asset = Asset::create([
            'name' => 'Printer HP LaserJet',
            'asset_code' => 'KU-MACH-2026-000001',
            'category_id' => $category->id,
            'status' => 'available',
            'condition' => 'good',
        ]);
    }

    public function test_maintenance_request_to_work_order_lifecycle(): void
    {
        $this->actingAsUserWithPermissions([
            'maintenance.view', 'maintenance.create', 'maintenance.update',
        ]);

        // 1. Maintenance request
        $response = $this->postJson('/api/maintenance-requests', [
            'asset_id' => $this->asset->id,
            'maintenance_type' => 'corrective',
            'priority' => 'high',
            'problem' => 'Paper jam and grinding noise',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.asset_id', $this->asset->id);

        $requestId = $response->json('data.id');
        $this->assertDatabaseHas('maintenance_requests', [
            'id' => $requestId,
            'status' => 'requested',
        ]);

        // 2. Approve the request
        $this->postJson("/api/maintenance-requests/{$requestId}/approve")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        // 3. Create a work order from the request
        $wo = $this->postJson('/api/maintenances', [
            'asset_id' => $this->asset->id,
            'maintenance_request_id' => $requestId,
            'maintenance_type' => 'corrective',
            'cost' => 150,
        ]);

        $wo->assertStatus(201)
            ->assertJsonPath('data.status', 'approved');

        // Creating a work order moves the asset to under_maintenance.
        $this->assertDatabaseHas('assets', ['id' => $this->asset->id, 'status' => 'under_maintenance']);

        $woId = $wo->json('data.id');

        // 4. Assign technician → in progress
        $tech = \App\Models\User::factory()->create(['username' => 'tech1', 'status' => 'active']);

        $this->patchJson("/api/maintenances/{$woId}/status", [
            'status' => 'assigned',
            'technician_id' => $tech->id,
        ])->assertStatus(200)->assertJsonPath('data.technician_id', $tech->id);

        $this->patchJson("/api/maintenances/{$woId}/status", [
            'status' => 'in_progress',
        ])->assertStatus(200)->assertJsonPath('data.status', 'in_progress');

        // 5. Complete: asset returns to available.
        $this->patchJson("/api/maintenances/{$woId}/status", [
            'status' => 'completed',
            'cost' => 200,
            'result' => 'Fuser unit replaced',
            'condition' => 'good',
        ])->assertStatus(200)->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('assets', ['id' => $this->asset->id, 'status' => 'available']);
        $this->assertDatabaseHas('asset_maintenances', ['id' => $woId, 'status' => 'completed', 'cost' => 200]);
    }

    public function test_invalid_work_order_transition_is_rejected(): void
    {
        $this->actingAsUserWithPermissions(['maintenance.view', 'maintenance.create', 'maintenance.update']);

        $wo = $this->postJson('/api/maintenances', [
            'asset_id' => $this->asset->id,
            'maintenance_type' => 'preventive',
        ])->assertStatus(201)->json('data');

        // requested → completed is not a valid transition (must be approved first).
        $this->patchJson("/api/maintenances/{$wo['id']}/status", ['status' => 'completed'])
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['status']]);
    }

    public function test_maintenance_validation_errors(): void
    {
        $this->actingAsUserWithPermissions(['maintenance.view', 'maintenance.create']);

        $this->postJson('/api/maintenance-requests', [
            'maintenance_type' => 'not-a-type',
            'problem' => 'x',
        ])->assertStatus(422)
            ->assertJsonStructure(['errors' => ['asset_id', 'maintenance_type']]);
    }

    public function test_maintenance_request_list_is_paginated(): void
    {
        $this->actingAsUserWithPermissions(['maintenance.view', 'maintenance.create']);

        $this->postJson('/api/maintenance-requests', [
            'asset_id' => $this->asset->id,
            'maintenance_type' => 'inspection',
            'problem' => 'Annual inspection',
        ])->assertStatus(201);

        $this->getJson('/api/maintenance-requests')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'total']]);
    }

    public function test_work_order_listing_shows_records(): void
    {
        $this->actingAsUserWithPermissions(['maintenance.view', 'maintenance.create']);

        $this->postJson('/api/maintenances', [
            'asset_id' => $this->asset->id,
            'maintenance_type' => 'preventive',
        ])->assertStatus(201);

        $this->getJson('/api/maintenances')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data.data');
    }
}

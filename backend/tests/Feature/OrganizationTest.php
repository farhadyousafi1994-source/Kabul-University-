<?php

namespace Tests\Feature;

use App\Domains\Organization\Models\Campus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

class OrganizationTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    public function test_campus_crud_lifecycle(): void
    {
        $this->actingAsUserWithPermissions([
            'organization.view', 'organization.create', 'organization.update', 'organization.delete',
        ]);

        // Create
        $response = $this->postJson('/api/campuses', [
            'code' => 'CAMP-MAIN',
            'name' => 'Main Campus',
            'address' => 'Jamal Mina, Kabul',
            'description' => 'Headquarters campus',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.code', 'CAMP-MAIN')
            ->assertJsonPath('data.name', 'Main Campus');

        $campusId = $response->json('data.id');
        $this->assertDatabaseHas('campuses', ['id' => $campusId, 'status' => 'active']);

        // Index
        $this->getJson('/api/campuses')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data.data')
            ->assertJsonStructure(['meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        // Show
        $this->getJson("/api/campuses/{$campusId}")
            ->assertStatus(200)
            ->assertJsonPath('data.id', $campusId);

        // Update
        $this->putJson("/api/campuses/{$campusId}", [
            'code' => 'CAMP-MAIN',
            'name' => 'Main Campus (Renamed)',
        ])->assertStatus(200)
            ->assertJsonPath('data.name', 'Main Campus (Renamed)');

        // Archive (soft delete)
        $this->deleteJson("/api/campuses/{$campusId}")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('campuses', ['id' => $campusId]);
    }

    public function test_campus_validation_errors(): void
    {
        $this->actingAsUserWithPermissions(['organization.view', 'organization.create']);

        $this->postJson('/api/campuses', [])
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['code', 'name']]);

        Campus::create(['code' => 'DUP', 'name' => 'Duplicate', 'status' => 'active']);

        $this->postJson('/api/campuses', ['code' => 'DUP', 'name' => 'Another'])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['code']]);
    }

    public function test_organization_permissions_are_enforced(): void
    {
        $this->actingAsUserWithPermissions(['organization.view']);

        $this->postJson('/api/faculties', ['code' => 'FAC', 'name' => 'Faculty'])
            ->assertStatus(403);
    }

    public function test_nested_organization_lookup_chain(): void
    {
        $this->actingAsSuperAdmin();

        $campus = Campus::create(['code' => 'CAMP-MAIN', 'name' => 'Main Campus', 'status' => 'active']);

        $faculty = \App\Domains\Organization\Models\Faculty::create([
            'campus_id' => $campus->id, 'code' => 'FAC-CS', 'name' => 'Computer Science', 'status' => 'active',
        ]);

        $department = \App\Domains\Organization\Models\Department::create([
            'faculty_id' => $faculty->id, 'code' => 'DEPT-CS-SW', 'name' => 'Software Engineering', 'status' => 'active',
        ]);

        $this->getJson('/api/campuses')->assertJsonPath('data.data.0.code', 'CAMP-MAIN');
        $this->getJson('/api/faculties?campus_id='.$campus->id)->assertJsonPath('data.data.0.code', 'FAC-CS');
        $this->getJson('/api/departments?faculty_id='.$faculty->id)->assertJsonPath('data.data.0.code', 'DEPT-CS-SW');
        $this->assertNotNull($department);
    }
}

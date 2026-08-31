<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

class UserRoleTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    public function test_user_crud_lifecycle(): void
    {
        $this->actingAsUserWithPermissions([
            'users.view', 'users.create', 'users.update', 'users.delete',
        ]);

        // Create
        $response = $this->postJson('/api/users', [
            'name' => 'Nadia Rahimi',
            'username' => 'nadia',
            'email' => 'nadia@ku.edu.af',
            'phone' => '+93 700 123 456',
            'password' => 'Secret123',
            'password_confirmation' => 'Secret123',
            'status' => 'active',
            'roles' => ['Employee'],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Nadia Rahimi');

        $userId = $response->json('data.id');
        $this->assertDatabaseHas('users', ['id' => $userId, 'username' => 'nadia']);

        $user = User::findOrFail($userId);
        $this->assertTrue($user->hasRole('Employee'));

        // Index + search
        $this->getJson('/api/users?search=nadia')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data.data');

        // Update
        $this->putJson("/api/users/{$userId}", [
            'name' => 'Nadia A. Rahimi',
            'username' => 'nadia',
            'email' => 'nadia@ku.edu.af',
            'roles' => ['Faculty Manager'],
        ])->assertStatus(200)
            ->assertJsonPath('data.name', 'Nadia A. Rahimi');

        $this->assertTrue($user->fresh()->hasRole('Faculty Manager'));

        // Deactivate → activate
        $this->postJson("/api/users/{$userId}/deactivate")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'inactive');

        $this->postJson("/api/users/{$userId}/activate")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'active');

        // Delete (soft)
        $this->deleteJson("/api/users/{$userId}")->assertStatus(200);
        $this->assertSoftDeleted('users', ['id' => $userId]);
    }

    public function test_user_creation_requires_valid_password(): void
    {
        $this->actingAsUserWithPermissions(['users.view', 'users.create']);

        $this->postJson('/api/users', [
            'name' => 'Weak Password User',
            'username' => 'weak',
            'email' => 'weak@ku.edu.af',
            'password' => 'short',
        ])->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['password']]);
    }

    public function test_role_crud_and_permission_sync(): void
    {
        $this->actingAsUserWithPermissions([
            'roles.view', 'roles.create', 'roles.update', 'roles.delete',
        ]);

        // Create role with a subset of permissions.
        $response = $this->postJson('/api/roles', [
            'name' => 'Lab Technician',
            'permissions' => ['assets.view', 'assets.assign', 'maintenance.view'],
        ]);

        $response->assertStatus(201)->assertJsonPath('data.name', 'Lab Technician');
        $roleId = $response->json('data.id');

        $role = Role::findOrFail($roleId);
        $this->assertTrue($role->hasPermissionTo('assets.assign'));
        $this->assertFalse($role->hasPermissionTo('assets.delete'));

        // Update permission set.
        $this->putJson("/api/roles/{$roleId}", [
            'name' => 'Lab Technician',
            'permissions' => ['assets.view', 'assets.return'],
        ])->assertStatus(200);

        $role->refresh();
        $this->assertTrue($role->hasPermissionTo('assets.return'));
        $this->assertFalse($role->hasPermissionTo('assets.assign'));

        // List roles & permission groups.
        $this->getJson('/api/roles')->assertStatus(200)->assertJsonPath('success', true);
        $this->getJson('/api/roles/permissions')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['assets', 'users', 'organization']]);

        // Delete.
        $this->deleteJson("/api/roles/{$roleId}")->assertStatus(200);
        $this->assertDatabaseMissing('roles', ['id' => $roleId]);
    }

    public function test_role_permissions_must_exist(): void
    {
        $this->actingAsUserWithPermissions(['roles.view', 'roles.create']);

        $this->postJson('/api/roles', [
            'name' => 'Bad Role',
            'permissions' => ['does.not.exist'],
        ])->assertStatus(422)
            ->assertJsonStructure(['errors' => ['permissions.0']]);
    }

    public function test_roles_list_is_permission_grouped(): void
    {
        $this->actingAsSuperAdmin();

        $response = $this->getJson('/api/roles/permissions')
            ->assertStatus(200);

        $data = $response->json('data');
        $this->assertArrayHasKey('assets', $data);
        $this->assertContains('assets.dispose', $data['assets']);
        $this->assertArrayHasKey('dashboard', $data);
    }
}

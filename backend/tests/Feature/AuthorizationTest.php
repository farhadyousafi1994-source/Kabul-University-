<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    /**
     * Unauthenticated API requests receive the envelope 401.
     */
    public function test_unauthenticated_request_returns_401_envelope(): void
    {
        $this->getJson('/api/campuses')
            ->assertStatus(401)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    /**
     * Authenticated users without the required permission get a 403.
     */
    public function test_missing_permission_returns_403(): void
    {
        $this->actingAsUserWithPermissions(['dashboard.view']);

        $this->getJson('/api/campuses')
            ->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'You do not have permission to perform this action.');
    }

    /**
     * The permission check is per-action: view permission does not grant writes.
     */
    public function test_view_permission_does_not_grant_write(): void
    {
        $this->actingAsUserWithPermissions(['organization.view']);

        $this->postJson('/api/campuses', ['code' => 'NEW', 'name' => 'New Campus'])
            ->assertStatus(403);
    }

    /**
     * Users with the exact permission can perform the action.
     */
    public function test_user_with_permission_can_access(): void
    {
        $this->actingAsUserWithPermissions(['organization.view']);

        $this->getJson('/api/campuses')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    /**
     * Deactivated users are blocked by the `active` middleware (403).
     */
    public function test_deactivated_user_is_blocked(): void
    {
        $user = User::factory()->create(['status' => 'inactive']);
        $this->actingAs($user, 'sanctum');

        $this->getJson('/api/me')
            ->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Your account is deactivated. Please contact the administrator.');
    }

    /**
     * Unknown API endpoints return the envelope 404.
     */
    public function test_unknown_route_returns_404_envelope(): void
    {
        $this->actingAsUserWithPermissions(['dashboard.view']);

        $this->getJson('/api/does-not-exist')
            ->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Resource not found.');
    }

    /**
     * Super Admin bypasses every permission check (wildcard role).
     */
    public function test_super_admin_can_access_everything(): void
    {
        $this->actingAsSuperAdmin();

        $this->getJson('/api/campuses')->assertStatus(200);
        $this->postJson('/api/campuses', ['code' => 'C1', 'name' => 'Campus One'])->assertStatus(201);
        $this->getJson('/api/users')->assertStatus(200);
        $this->getJson('/api/settings')->assertStatus(200);
    }
}

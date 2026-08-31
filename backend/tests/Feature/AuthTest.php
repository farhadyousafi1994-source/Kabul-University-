<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A valid login returns the envelope with a token and the user payload.
     */
    public function test_login_succeeds_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'username' => 'admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('Secret123'),
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'admin',
            'password' => 'Secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Login successful.')
            ->assertJsonStructure(['data' => ['token', 'user']]);

        $this->assertNotEmpty($response->json('data.token'));
        $this->assertSame($user->id, $response->json('data.user.id'));
    }

    /**
     * Email is accepted as the login identifier as well.
     */
    public function test_login_accepts_email_identifier(): void
    {
        User::factory()->create([
            'username' => 'staff',
            'email' => 'staff@example.com',
            'password' => Hash::make('Secret123'),
            'status' => 'active',
        ]);

        $this->postJson('/api/login', [
            'login' => 'staff@example.com',
            'password' => 'Secret123',
        ])->assertStatus(200)->assertJsonPath('success', true);
    }

    /**
     * Wrong credentials produce a 422 with an error on the `login` field.
     */
    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->create([
            'username' => 'admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('Secret123'),
        ]);

        $response = $this->postJson('/api/login', [
            'login' => 'admin',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['login']]);
    }

    /**
     * Validation errors (missing fields) use the standard envelope.
     */
    public function test_login_validation_error_shape(): void
    {
        $this->postJson('/api/login', [])
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['message', 'errors' => ['login', 'password']]);
    }

    /**
     * Deactivated accounts receive a 403 with the envelope shape.
     */
    public function test_login_rejected_for_deactivated_user(): void
    {
        User::factory()->create([
            'username' => 'inactive',
            'email' => 'inactive@example.com',
            'password' => Hash::make('Secret123'),
            'status' => 'inactive',
        ]);

        $this->postJson('/api/login', [
            'login' => 'inactive',
            'password' => 'Secret123',
        ])->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Your account is deactivated. Please contact the administrator.');
    }

    /**
     * /api/me returns the authenticated user with roles and permissions.
     */
    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->create(['status' => 'active']);
        $this->actingAs($user, 'sanctum');

        $this->getJson('/api/me')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.id', $user->id);
    }

    /**
     * A valid change-password updates the stored hash.
     */
    public function test_change_password_updates_hash(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('Secret123'),
            'status' => 'active',
        ]);
        $this->actingAs($user, 'sanctum');

        $this->postJson('/api/change-password', [
            'current_password' => 'Secret123',
            'new_password' => 'NewSecret456',
            'new_password_confirmation' => 'NewSecret456',
        ])->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Password changed successfully.');

        $this->assertTrue(Hash::check('NewSecret456', $user->fresh()->password));
    }

    /**
     * Wrong current password is rejected with a 422.
     */
    public function test_change_password_rejects_wrong_current_password(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('Secret123'),
            'status' => 'active',
        ]);
        $this->actingAs($user, 'sanctum');

        $this->postJson('/api/change-password', [
            'current_password' => 'NotThePassword',
            'new_password' => 'NewSecret456',
            'new_password_confirmation' => 'NewSecret456',
        ])->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['current_password']]);
    }

    /**
     * Logout revokes the token, after which /api/me is rejected.
     */
    public function test_logout_revokes_token(): void
    {
        $user = User::factory()->create(['status' => 'active']);
        $token = $user->createToken('ku-ams')->plainTextToken;

        $this->withToken($token)->postJson('/api/logout')->assertStatus(200);

        $this->withToken($token)->getJson('/api/me')->assertStatus(401);
    }
}

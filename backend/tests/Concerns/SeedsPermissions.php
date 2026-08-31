<?php

namespace Tests\Concerns;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

/**
 * Helpers for tests that exercise the permission system.
 *
 * RolesAndPermissionsSeeder creates every permission listed in the matrix,
 * so tests can `givePermissionTo('assets.view')` immediately after seeding.
 */
trait SeedsPermissions
{
    /**
     * Seed the full permission matrix once per test.
     */
    protected function seedPermissions(): void
    {
        if (! Role::query()->where('name', 'Super Admin')->exists()) {
            $this->seed(RolesAndPermissionsSeeder::class);
        }
    }

    /**
     * Create a user with the given permissions (and no roles).
     *
     * @param  list<string>  $permissions
     */
    protected function createUserWithPermissions(array $permissions = []): User
    {
        $this->seedPermissions();

        $user = User::factory()->create([
            'username' => 'test_user_'.Str::random(8),
            'status' => 'active',
        ]);

        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        return $user;
    }

    /**
     * Authenticate as a user holding exactly the given permissions.
     *
     * @param  list<string>  $permissions
     */
    protected function actingAsUserWithPermissions(array $permissions = []): User
    {
        $user = $this->createUserWithPermissions($permissions);
        Sanctum::actingAs($user);

        return $user;
    }

    /**
     * Authenticate as a user with the Super Admin role (all permissions).
     */
    protected function actingAsSuperAdmin(): User
    {
        $this->seedPermissions();

        $user = User::factory()->create([
            'username' => 'superadmin_'.Str::random(6),
            'status' => 'active',
        ]);
        $user->assignRole('Super Admin');

        Sanctum::actingAs($user);

        return $user;
    }
}

<?php

namespace Tests\Feature;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\HR\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

/**
 * Employees module — dedicated table, CRUD, asset relation and safe deletes.
 */
class EmployeeTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    private function makeEmployee(array $overrides = []): Employee
    {
        return Employee::create(array_merge([
            'employee_code' => Employee::nextCode(),
            'first_name' => 'Ahmad',
            'last_name' => 'Karimi',
            'email' => 'ahmad.karimi@ku.edu.af',
            'employment_type' => 'full_time',
            'status' => 'active',
        ], $overrides));
    }

    public function test_employee_crud_lifecycle(): void
    {
        $this->actingAsUserWithPermissions([
            'employees.view', 'employees.create', 'employees.update', 'employees.delete',
        ]);

        // Create
        $response = $this->postJson('/api/employees', [
            'first_name' => 'Sara',
            'last_name' => 'Rahimi',
            'email' => 'sara.rahimi@ku.edu.af',
            'phone' => '+93 700 111 222',
            'position' => 'Lecturer',
            'employment_type' => 'contract',
            'status' => 'active',
            'hire_date' => '2026-01-10',
        ]);

        $response->assertCreated()->assertJsonPath('data.full_name', 'Sara Rahimi');
        $id = $response->json('data.id');
        $this->assertStringStartsWith('EMP-', $response->json('data.employee_code'));

        // Read
        $this->getJson("/api/employees/{$id}")
            ->assertOk()
            ->assertJsonPath('data.asset_summary.total', 0);

        // Update
        $this->putJson("/api/employees/{$id}", [
            'first_name' => 'Sara',
            'last_name' => 'Rahimi',
            'position' => 'Senior Lecturer',
            'employment_type' => 'full_time',
        ])->assertOk()->assertJsonPath('data.position', 'Senior Lecturer');

        // Delete (no assets assigned — allowed)
        $this->deleteJson("/api/employees/{$id}")->assertOk();
        $this->assertSoftDeleted('employees', ['id' => $id]);
    }

    public function test_employee_validation_rules(): void
    {
        $this->actingAsUserWithPermissions(['employees.view', 'employees.create']);

        $this->postJson('/api/employees', ['email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['first_name', 'last_name', 'email']);
    }

    public function test_employee_and_user_stay_separate_entities(): void
    {
        $this->actingAsUserWithPermissions(['employees.view', 'employees.create', 'employees.delete']);

        $account = User::factory()->create(['username' => 'linked', 'status' => 'active']);
        $employee = $this->makeEmployee(['user_id' => $account->id]);

        // Deleting the employee never touches the user account.
        $this->deleteJson("/api/employees/{$employee->id}")->assertOk();
        $this->assertDatabaseHas('users', ['id' => $account->id, 'deleted_at' => null]);
    }

    public function test_asset_can_be_assigned_and_unassigned(): void
    {
        $this->actingAsUserWithPermissions([
            'employees.view', 'assets.view', 'assets.create', 'assets.update',
        ]);

        $category = AssetCategory::create(['code' => 'IT', 'name' => 'IT Equipment', 'status' => 'active']);
        $employee = $this->makeEmployee();

        // Create the asset directly assigned to the employee.
        $create = $this->postJson('/api/assets', [
            'name' => 'HP EliteBook',
            'category_id' => $category->id,
            'employee_id' => $employee->id,
        ]);
        $create->assertCreated()
            ->assertJsonPath('data.employee_id', $employee->id)
            ->assertJsonPath('data.status', Asset::STATUS_ASSIGNED);

        $assetId = $create->json('data.id');

        // The employee's asset list shows it.
        $this->getJson("/api/employees/{$employee->id}/assets")
            ->assertOk()
            ->assertJsonCount(1, 'data.data');

        // Unassign — status flips back to available.
        $this->putJson("/api/assets/{$assetId}", [
            'name' => 'HP EliteBook',
            'category_id' => $category->id,
            'employee_id' => null,
        ])->assertOk()
            ->assertJsonPath('data.employee_id', null)
            ->assertJsonPath('data.status', Asset::STATUS_AVAILABLE);
    }

    public function test_employee_with_assets_cannot_be_deleted(): void
    {
        $this->actingAsUserWithPermissions([
            'employees.view', 'employees.delete', 'assets.view', 'assets.create',
        ]);

        $category = AssetCategory::create(['code' => 'IT', 'name' => 'IT Equipment', 'status' => 'active']);
        $employee = $this->makeEmployee();

        $this->postJson('/api/assets', [
            'name' => 'Dell Monitor',
            'category_id' => $category->id,
            'employee_id' => $employee->id,
        ])->assertCreated();

        // Delete refused with a clear message; asset survives untouched.
        $this->deleteJson("/api/employees/{$employee->id}")
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('employees', ['id' => $employee->id, 'deleted_at' => null]);
        $this->assertDatabaseCount('assets', 1);
    }

    public function test_employees_endpoints_require_permission(): void
    {
        $this->actingAsUserWithPermissions(['dashboard.view']);

        $this->getJson('/api/employees')->assertForbidden();
        $this->postJson('/api/employees', [])->assertForbidden();
    }
}

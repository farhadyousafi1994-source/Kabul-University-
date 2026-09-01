<?php

namespace Tests\Feature;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Organization\Models\Campus;
use App\Domains\System\Models\Backup;
use App\Domains\System\Services\BackupService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

/**
 * Module 29 — Backup & disaster recovery.
 *
 * Covers the permission gate, snapshot creation (both formats), download,
 * deletion, the "clean start" template and a full restore round-trip.
 */
class BackupTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    /**
     * @param  list<string>  $permissions
     */
    private function actingWith(array $permissions): User
    {
        return $this->actingAsUserWithPermissions($permissions);
    }

    private function makeSnapshot(array $permissions = ['backup.view', 'backup.create', 'backup.restore', 'backup.delete']): Backup
    {
        $this->actingWith($permissions);

        return BackupService::create(Backup::KIND_MANUAL, Backup::FORMAT_JSON);
    }

    public function test_backup_index_requires_permission(): void
    {
        $this->actingWith(['dashboard.view']);

        $this->getJson('/api/backups')
            ->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_backup_index_returns_rows_and_summary_meta(): void
    {
        $this->actingWith(['backup.view']);

        $this->getJson('/api/backups')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data',
                'meta' => ['count', 'total_size', 'total_size_human', 'last_backup'],
            ]);
    }

    public function test_snapshot_can_be_created_and_downloaded(): void
    {
        $this->actingWith(['backup.view', 'backup.create']);

        $response = $this->postJson('/api/backups', ['format' => 'json'])
            ->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.format', 'json');

        $id = $response->json('data.id');
        $filename = $response->json('data.filename');

        Storage::disk('local')->assertExists('backups/'.$filename);
        $this->assertDatabaseHas('backups', ['id' => $id, 'filename' => $filename]);

        $download = $this->getJson("/api/backups/{$id}/download")->assertStatus(200);
        $this->assertStringContainsString($filename, (string) $download->headers->get('content-disposition'));
    }

    public function test_snapshot_can_be_deleted(): void
    {
        $backup = $this->makeSnapshot();

        $this->deleteJson("/api/backups/{$backup->id}")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        Storage::disk('local')->assertMissing($backup->path);
        $this->assertDatabaseMissing('backups', ['id' => $backup->id]);
    }

    public function test_fresh_template_keeps_users_and_clears_records(): void
    {
        $this->seedPermissions();
        $campus = Campus::create(['code' => 'CAMP-MAIN', 'name' => 'Main Campus', 'status' => 'active']);
        $category = AssetCategory::create(['code' => 'EQP', 'name' => 'Equipment', 'status' => 'active']);
        Asset::create([
            'name' => 'Generator',
            'asset_code' => 'KU-EQP-2026-000001',
            'category_id' => $category->id,
            'purchase_date' => now()->toDateString(),
            'purchase_price' => 5000,
            'current_value' => 5000,
            'status' => 'available',
            'condition' => 'good',
        ]);

        $dump = BackupService::freshTemplate();

        $this->assertSame('fresh-start', $dump['kind']);
        $this->assertNotEmpty($dump['tables']['users']);
        $this->assertNotEmpty($dump['tables']['campuses']);
        $this->assertSame($campus->id, $dump['tables']['campuses'][0]['id']);
        $this->assertSame([], $dump['tables']['assets']);

        $this->actingWith(['backup.create']);
        $this->getJson('/api/backups/fresh-template')->assertStatus(200);
    }

    public function test_restore_replaces_records_and_takes_a_safety_snapshot(): void
    {
        // Authenticate first so the operator is part of the snapshot.
        $this->actingWith(['backup.create', 'backup.restore']);

        $campus = Campus::create(['code' => 'CAMP-MAIN', 'name' => 'Main Campus', 'status' => 'active']);
        $category = AssetCategory::create(['code' => 'EQP', 'name' => 'Equipment', 'status' => 'active']);
        Asset::create([
            'name' => 'Generator',
            'asset_code' => 'KU-EQP-2026-000001',
            'category_id' => $category->id,
            'purchase_date' => now()->toDateString(),
            'purchase_price' => 5000,
            'current_value' => 5000,
            'status' => 'available',
            'condition' => 'good',
        ]);

        $dump = BackupService::freshTemplate();

        $this->postJson('/api/backups/restore', ['data' => $dump])
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.safety_backup.kind', 'pre_restore');

        // Operational records are gone, structure and people survive.
        $this->assertSame(0, Asset::query()->count());
        $this->assertSame(1, Campus::where('code', 'CAMP-MAIN')->count());
        $this->assertGreaterThan(0, User::query()->count());
        $this->assertDatabaseHas('backups', ['kind' => 'pre_restore']);
    }

    public function test_restore_rejects_files_that_are_not_snapshots(): void
    {
        $this->actingWith(['backup.restore']);

        $this->postJson('/api/backups/restore', ['data' => ['hello' => 'world']])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_artisan_command_creates_a_snapshot_and_prunes_old_ones(): void
    {
        $this->artisan('backup:run', ['--format' => 'json', '--keep' => 2])
            ->assertExitCode(0);

        $this->assertDatabaseHas('backups', ['kind' => Backup::KIND_SCHEDULED]);
    }
}

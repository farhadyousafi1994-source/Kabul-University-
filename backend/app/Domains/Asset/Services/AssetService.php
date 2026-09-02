<?php

namespace App\Domains\Asset\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetAssignment;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Asset\Models\AssetLocationHistory;
use App\Domains\HR\Models\Employee;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\SettingsService;
use Illuminate\Support\Str;

/**
 * Business logic for the core Asset Management module.
 */
class AssetService
{
    public const CODE_FORMAT = 'KU-{CATEGORY}-{YEAR}-{NUMBER}';

    /**
     * Generate the next asset code for a category.
     * Format: KU-{CATEGORY}-{YEAR}-{NUMBER} (e.g. KU-IT-2026-000001)
     */
    public static function generateCode(AssetCategory $category): string
    {
        $format = SettingsService::get('asset_code_format', self::CODE_FORMAT);
        $year = now()->format('Y');
        $prefix = $category->code !== null
            ? (string) preg_replace('/^CAT-/', '', $category->code)
            : strtoupper(Str::substr($category->name, 0, 3));

        $last = Asset::withTrashed()
            ->where('asset_code', 'like', "KU-{$prefix}-{$year}-%")
            ->orderByDesc('asset_code')
            ->value('asset_code');

        $number = 1;
        if ($last) {
            $number = ((int) Str::afterLast($last, '-')) + 1;
        }

        $code = str_replace(
            ['{CATEGORY}', '{YEAR}', '{NUMBER}'],
            [$prefix, $year, str_pad((string) $number, 6, '0', STR_PAD_LEFT)],
            $format,
        );

        return $code;
    }

    /**
     * Create an asset, generate its codes, record initial location history
     * and audit trail.
     *
     * @param  array<string, mixed>  $data
     */
    public static function create(array $data, ?int $userId = null): Asset
    {
        $category = AssetCategory::findOrFail($data['category_id']);

        $data['asset_code'] = self::generateCode($category);
        $data['barcode'] = $data['barcode'] ?? self::generateBarcode();
        $data['qr_code'] = $data['qr_code'] ?? self::generateQrCode();
        $data['created_by'] = $userId ?? auth('sanctum')->id();

        // Creating an asset already in an employee's hands ⇒ status assigned.
        if (! empty($data['employee_id']) && ($data['status'] ?? Asset::STATUS_AVAILABLE) === Asset::STATUS_AVAILABLE) {
            $data['status'] = Asset::STATUS_ASSIGNED;
        }

        $asset = Asset::create($data);

        // Initial location history row — every asset must be traceable.
        self::recordLocation($asset, 'Initial registration');

        if (! empty($data['employee_id'])) {
            self::syncAssignmentRows($asset, $data['employee_id'], $userId);
        }

        ActivityLogService::record('created', 'Assets', Asset::class, $asset->id, $asset->name, null, $asset->toArray(), $userId);

        return $asset;
    }

    /**
     * Update an asset; automatically records a location history row when the
     * physical location changed.
     *
     * @param  array<string, mixed>  $data
     */
    public static function update(Asset $asset, array $data): Asset
    {
        $locationChanged = self::locationChanged($asset, $data);

        if (array_key_exists('employee_id', $data) && $data['employee_id'] === '') {
            $data['employee_id'] = null;
        }

        // Keep status in step with a direct employee (un)assignment when the
        // caller did not choose an explicit status themselves.
        if (array_key_exists('employee_id', $data)
            && (int) ($data['employee_id'] ?? 0) !== (int) ($asset->employee_id ?? 0)
            && ! array_key_exists('status', $data)) {
            if (! empty($data['employee_id'])) {
                if (in_array($asset->status, [Asset::STATUS_AVAILABLE, Asset::STATUS_ASSIGNED, Asset::STATUS_RESERVED], true)) {
                    $data['status'] = Asset::STATUS_ASSIGNED;
                }
            } elseif ($asset->status === Asset::STATUS_ASSIGNED) {
                $data['status'] = Asset::STATUS_AVAILABLE;
            }
        }

        $asset->update($data);

        if ($locationChanged) {
            self::recordLocation($asset, 'Location updated');
        }

        if (array_key_exists('employee_id', $data)) {
            self::syncAssignmentRows($asset, $data['employee_id']);
        }

        ActivityLogService::record('updated', 'Assets', Asset::class, $asset->id, $asset->name, null, $data);

        return $asset->fresh();
    }

    /**
     * Archive (soft delete) an asset. Historical records are preserved.
     */
    public static function archive(Asset $asset): void
    {
        $label = $asset->name;
        $asset->delete();

        ActivityLogService::record('deleted', 'Assets', Asset::class, $asset->id, $label);
    }

    /**
     * Record a location history row and update the asset's current location.
     */
    public static function recordLocation(Asset $asset, string $reason, ?int $userId = null): AssetLocationHistory
    {
        $history = AssetLocationHistory::create([
            'asset_id' => $asset->id,
            'campus_id' => $asset->campus_id,
            'faculty_id' => $asset->faculty_id,
            'department_id' => $asset->department_id,
            'building_id' => $asset->building_id,
            'floor_id' => $asset->floor_id,
            'room_id' => $asset->room_id,
            'moved_by' => $userId ?? auth('sanctum')->id(),
            'moved_at' => now(),
            'reason' => $reason,
        ]);

        return $history;
    }

    /**
     * Move an asset to a new location and record history atomically.
     *
     * @param  array{campus_id?: int|null, faculty_id?: int|null, department_id?: int|null, building_id?: int|null, floor_id?: int|null, room_id?: int|null}  $location
     */
    public static function move(Asset $asset, array $location, string $reason, ?int $userId = null): void
    {
        $asset->update($location);
        self::recordLocation($asset, $reason, $userId);

        ActivityLogService::record('transferred', 'Assets', Asset::class, $asset->id, $asset->name, null, $location, $userId);
    }

    /**
     * Keep `asset_assignments` in step with `assets.employee_id`.
     *
     * Closing an active row here does NOT call AssignmentService::returnAsset:
     * that helper forces `status = available` and would clobber
     * `under_maintenance`. Creating a new row here also does not flip status —
     * the caller already decided that.
     *
     * Do not early-return when both the current and target employee are null
     * if an active assignment still exists (orphan-active-assignment bug).
     */
    protected static function syncAssignmentRows(Asset $asset, mixed $targetEmployeeId, ?int $assignedBy = null): void
    {
        $target = $targetEmployeeId === null || $targetEmployeeId === ''
            ? null
            : (int) $targetEmployeeId;

        $actives = $asset->assignments()
            ->where('status', AssetAssignment::STATUS_ACTIVE)
            ->orderByDesc('id')
            ->get();

        $active = $actives->first();
        $activeEmployeeId = $active?->employee_id !== null ? (int) $active->employee_id : null;

        if ($target === $activeEmployeeId && $actives->count() <= 1 && ($target !== null || $active === null)) {
            return;
        }

        if ($actives->isNotEmpty()) {
            AssetAssignment::query()
                ->whereIn('id', $actives->pluck('id'))
                ->update([
                    'status' => AssetAssignment::STATUS_RETURNED,
                    'returned_date' => now()->toDateString(),
                ]);
        }

        if ($target === null) {
            return;
        }

        $employee = Employee::query()->find($target);
        if (! $employee) {
            return;
        }

        AssetAssignment::create([
            'asset_id' => $asset->id,
            'employee_id' => $employee->id,
            'assigned_to_user_id' => $employee->user_id,
            'assigned_by' => $assignedBy ?? auth('sanctum')->id(),
            'assigned_date' => now()->toDateString(),
            'status' => AssetAssignment::STATUS_ACTIVE,
        ]);
    }

    protected static function locationChanged(Asset $asset, array $data): bool
    {
        $columns = ['campus_id', 'faculty_id', 'department_id', 'building_id', 'floor_id', 'room_id'];

        foreach ($columns as $column) {
            if (array_key_exists($column, $data) && (int) ($data[$column] ?? 0) !== (int) $asset->{$column}) {
                return true;
            }
        }

        return false;
    }

    protected static function generateBarcode(): string
    {
        do {
            $barcode = '62'.random_int(10000000000, 99999999999); // 13-digit GTIN-style
        } while (Asset::where('barcode', $barcode)->exists());

        return $barcode;
    }

    protected static function generateQrCode(): string
    {
        return 'KUQR-'.strtoupper(Str::random(16));
    }
}

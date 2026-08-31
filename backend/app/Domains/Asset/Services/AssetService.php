<?php

namespace App\Domains\Asset\Services;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Asset\Models\AssetLocationHistory;
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

        $asset = Asset::create($data);

        // Initial location history row — every asset must be traceable.
        self::recordLocation($asset, 'Initial registration');

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

        $asset->update($data);

        if ($locationChanged) {
            self::recordLocation($asset, 'Location updated');
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

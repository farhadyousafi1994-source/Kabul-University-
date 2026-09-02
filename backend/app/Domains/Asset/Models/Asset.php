<?php

namespace App\Domains\Asset\Models;

use App\Domains\Audit\Models\AssetAuditItem;
use App\Domains\Financial\Models\AssetDepreciation;
use App\Domains\Financial\Models\AssetDisposal;
use App\Domains\Maintenance\Models\AssetIncident;
use App\Domains\Maintenance\Models\AssetMaintenance;
use App\Domains\Maintenance\Models\MaintenanceRequest;
use App\Domains\Organization\Models\Building;
use App\Domains\Organization\Models\Campus;
use App\Domains\Organization\Models\Department;
use App\Domains\Organization\Models\Floor;
use App\Domains\Organization\Models\Room;
use App\Domains\Procurement\Models\Supplier;
use App\Domains\Warehouse\Models\WarehouseTransaction;
use App\Domains\HR\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Asset extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_AVAILABLE = 'available';
    public const STATUS_ASSIGNED = 'assigned';
    public const STATUS_RESERVED = 'reserved';
    public const STATUS_UNDER_MAINTENANCE = 'under_maintenance';
    public const STATUS_DAMAGED = 'damaged';
    public const STATUS_LOST = 'lost';
    public const STATUS_STOLEN = 'stolen';
    public const STATUS_DISPOSED = 'disposed';
    public const STATUS_RETIRED = 'retired';

    public const STATUSES = [
        self::STATUS_AVAILABLE,
        self::STATUS_ASSIGNED,
        self::STATUS_RESERVED,
        self::STATUS_UNDER_MAINTENANCE,
        self::STATUS_DAMAGED,
        self::STATUS_LOST,
        self::STATUS_STOLEN,
        self::STATUS_DISPOSED,
        self::STATUS_RETIRED,
    ];

    public const CONDITION_EXCELLENT = 'excellent';
    public const CONDITION_GOOD = 'good';
    public const CONDITION_FAIR = 'fair';
    public const CONDITION_POOR = 'poor';
    public const CONDITION_DAMAGED = 'damaged';

    public const CONDITIONS = [
        self::CONDITION_EXCELLENT,
        self::CONDITION_GOOD,
        self::CONDITION_FAIR,
        self::CONDITION_POOR,
        self::CONDITION_DAMAGED,
    ];

    protected $fillable = [
        'asset_code', 'name', 'description', 'category_id', 'subcategory_id',
        'brand', 'model', 'serial_number', 'barcode', 'qr_code',
        'purchase_date', 'purchase_price', 'current_value', 'salvage_value',
        'supplier_id', 'warranty_expiry_date', 'useful_life',
        'status', 'condition',
        'campus_id', 'faculty_id', 'department_id', 'building_id', 'floor_id', 'room_id',
        'employee_id',
        'created_by',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'warranty_expiry_date' => 'date',
        'purchase_price' => 'decimal:2',
        'current_value' => 'decimal:2',
        'salvage_value' => 'decimal:2',
    ];

    // ------------------------------------------------------------------
    // Relationships
    // ------------------------------------------------------------------

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class);
    }

    public function subcategory(): BelongsTo
    {
        return $this->belongsTo(AssetSubcategory::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }

    public function faculty(): BelongsTo
    {
        return $this->belongsTo(\App\Domains\Organization\Models\Faculty::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function floor(): BelongsTo
    {
        return $this->belongsTo(Floor::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** Employee currently holding this asset (direct assignment). */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(AssetImage::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(AssetDocument::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(AssetAssignment::class);
    }

    public function activeAssignment()
    {
        return $this->hasOne(AssetAssignment::class)->where('status', AssetAssignment::STATUS_ACTIVE);
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(AssetTransfer::class);
    }

    public function locationHistories(): HasMany
    {
        return $this->hasMany(AssetLocationHistory::class);
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(AssetMaintenance::class);
    }

    public function depreciations(): HasMany
    {
        return $this->hasMany(AssetDepreciation::class);
    }

    public function disposal(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(AssetDisposal::class)->latestOfMany();
    }

    // ------------------------------------------------------------------
    // Scopes
    // ------------------------------------------------------------------

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (! $search) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($search) {
            $q->where('asset_code', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('serial_number', 'like', "%{$search}%")
                ->orWhere('barcode', 'like', "%{$search}%")
                ->orWhere('qr_code', 'like', "%{$search}%")
                ->orWhere('brand', 'like', "%{$search}%")
                ->orWhere('model', 'like', "%{$search}%");
        });
    }

    public function scopeFilterStatus(Builder $query, ?string $status): Builder
    {
        return $status ? $query->where('status', $status) : $query;
    }

    public function scopeFilterCondition(Builder $query, ?string $condition): Builder
    {
        return $condition ? $query->where('condition', $condition) : $query;
    }

    public function scopeFilterCategory(Builder $query, ?int $categoryId): Builder
    {
        return $categoryId ? $query->where('category_id', $categoryId) : $query;
    }

    public function scopeFilterLocation(Builder $query, string $column, ?int $id): Builder
    {
        return $id ? $query->where($column, $id) : $query;
    }

    public function scopeAvailable(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_AVAILABLE);
    }

    public function scopeNotDisposed(Builder $query): Builder
    {
        return $query->whereNotIn('status', [self::STATUS_DISPOSED, self::STATUS_RETIRED]);
    }

    public function scopeSort(Builder $query, ?string $sort, ?string $direction): Builder
    {
        $sortable = ['name', 'asset_code', 'purchase_date', 'purchase_price', 'current_value', 'status', 'created_at'];
        $column = in_array($sort, $sortable, true) ? $sort : 'created_at';
        $dir = strtolower($direction ?? 'desc') === 'asc' ? 'asc' : 'desc';

        return $query->orderBy($column, $dir);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    public function isAvailable(): bool
    {
        return $this->status === self::STATUS_AVAILABLE;
    }
}

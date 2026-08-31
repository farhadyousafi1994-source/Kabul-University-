<?php

namespace App\Domains\Organization\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Room extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    public const TYPE_OFFICE = 'office';
    public const TYPE_LABORATORY = 'laboratory';
    public const TYPE_LIBRARY = 'library';
    public const TYPE_WAREHOUSE = 'warehouse';
    public const TYPE_CLASSROOM = 'classroom';
    public const TYPE_GENERAL = 'general';

    public const TYPES = [
        self::TYPE_OFFICE,
        self::TYPE_LABORATORY,
        self::TYPE_LIBRARY,
        self::TYPE_WAREHOUSE,
        self::TYPE_CLASSROOM,
        self::TYPE_GENERAL,
    ];

    protected $fillable = ['floor_id', 'code', 'name', 'room_type', 'capacity', 'status'];

    public function floor(): BelongsTo
    {
        return $this->belongsTo(Floor::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (! $search) {
            return $query;
        }

        return $query->where(fn (Builder $q) => $q
            ->where('name', 'like', "%{$search}%")
            ->orWhere('code', 'like', "%{$search}%"));
    }
}

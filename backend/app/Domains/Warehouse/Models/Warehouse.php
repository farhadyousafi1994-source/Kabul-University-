<?php

namespace App\Domains\Warehouse\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model
{
    use SoftDeletes;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = ['code', 'name', 'location', 'keeper_id', 'status'];

    public function keeper(): BelongsTo
    {
        return $this->belongsTo(User::class, 'keeper_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WarehouseTransaction::class);
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

<?php

namespace App\Domains\Asset\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetCategory extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = ['code', 'name', 'description', 'status'];

    public function subcategories(): HasMany
    {
        return $this->hasMany(AssetSubcategory::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
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

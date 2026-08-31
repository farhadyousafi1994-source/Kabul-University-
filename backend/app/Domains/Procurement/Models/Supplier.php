<?php

namespace App\Domains\Procurement\Models;

use App\Domains\Asset\Models\Asset;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'code', 'name', 'company_name', 'contact_person', 'phone',
        'email', 'address', 'tax_number', 'status',
    ];

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
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
            ->orWhere('company_name', 'like', "%{$search}%")
            ->orWhere('contact_person', 'like', "%{$search}%")
            ->orWhere('email', 'like', "%{$search}%"));
    }
}

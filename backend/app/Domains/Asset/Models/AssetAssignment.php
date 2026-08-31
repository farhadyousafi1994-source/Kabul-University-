<?php

namespace App\Domains\Asset\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAssignment extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_RETURNED = 'returned';
    public const STATUS_OVERDUE = 'overdue';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_RETURNED, self::STATUS_OVERDUE];

    protected $fillable = [
        'asset_id', 'assigned_to_user_id', 'assigned_by', 'assigned_date',
        'expected_return_date', 'returned_date', 'condition_on_return', 'status', 'notes',
    ];

    protected $casts = [
        'assigned_date' => 'date',
        'expected_return_date' => 'date',
        'returned_date' => 'date',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE)
            ->whereNotNull('expected_return_date')
            ->where('expected_return_date', '<', now()->toDateString());
    }
}

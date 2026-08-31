<?php

namespace App\Domains\Maintenance\Models;

use App\Domains\Asset\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMaintenance extends Model
{
    public const STATUS_REQUESTED = 'requested';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_ASSIGNED = 'assigned';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_REQUESTED, self::STATUS_APPROVED, self::STATUS_ASSIGNED,
        self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED, self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'maintenance_request_id', 'asset_id', 'technician_id', 'maintenance_type',
        'scheduled_date', 'start_date', 'end_date', 'cost', 'notes', 'result', 'status',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
        'cost' => 'decimal:2',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRequest::class, 'maintenance_request_id');
    }
}

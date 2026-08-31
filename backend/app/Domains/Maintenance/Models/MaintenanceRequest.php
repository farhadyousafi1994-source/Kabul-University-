<?php

namespace App\Domains\Maintenance\Models;

use App\Domains\Asset\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class MaintenanceRequest extends Model
{
    public const TYPE_PREVENTIVE = 'preventive';
    public const TYPE_CORRECTIVE = 'corrective';
    public const TYPE_EMERGENCY = 'emergency';
    public const TYPE_INSPECTION = 'inspection';

    public const TYPES = [self::TYPE_PREVENTIVE, self::TYPE_CORRECTIVE, self::TYPE_EMERGENCY, self::TYPE_INSPECTION];

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

    protected $fillable = ['asset_id', 'requested_by', 'maintenance_type', 'priority', 'problem', 'status'];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function workOrder(): HasOne
    {
        return $this->hasOne(AssetMaintenance::class);
    }
}

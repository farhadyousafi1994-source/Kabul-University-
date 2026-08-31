<?php

namespace App\Domains\Audit\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetAudit extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED, self::STATUS_CANCELLED];

    public const SCOPE_TYPES = ['campus', 'faculty', 'department', 'building', 'floor', 'room', 'warehouse'];

    protected $fillable = [
        'audit_code', 'auditor_id', 'scope_type', 'scope_id',
        'scheduled_at', 'started_at', 'completed_at', 'status', 'summary',
    ];

    protected $casts = [
        'scheduled_at' => 'date',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function auditor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auditor_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AssetAuditItem::class);
    }
}

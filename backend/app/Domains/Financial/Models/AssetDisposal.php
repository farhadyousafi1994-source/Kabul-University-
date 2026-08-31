<?php

namespace App\Domains\Financial\Models;

use App\Domains\Asset\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetDisposal extends Model
{
    public const METHOD_SOLD = 'sold';
    public const METHOD_DONATED = 'donated';
    public const METHOD_RECYCLED = 'recycled';
    public const METHOD_DESTROYED = 'destroyed';

    public const METHODS = [self::METHOD_SOLD, self::METHOD_DONATED, self::METHOD_RECYCLED, self::METHOD_DESTROYED];

    public const STATUS_DRAFT = 'draft';
    public const STATUS_REQUESTED = 'requested';
    public const STATUS_INSPECTED = 'inspected';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_DISPOSED = 'disposed';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_DRAFT, self::STATUS_REQUESTED, self::STATUS_INSPECTED,
        self::STATUS_APPROVED, self::STATUS_DISPOSED, self::STATUS_COMPLETED, self::STATUS_REJECTED,
    ];

    protected $fillable = [
        'asset_id', 'method', 'requested_by', 'approved_by',
        'request_date', 'approval_date', 'disposal_date', 'status', 'revenue', 'notes',
    ];

    protected $casts = [
        'request_date' => 'date',
        'approval_date' => 'date',
        'disposal_date' => 'date',
        'revenue' => 'decimal:2',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}

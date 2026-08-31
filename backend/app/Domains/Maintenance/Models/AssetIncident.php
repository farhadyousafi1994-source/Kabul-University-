<?php

namespace App\Domains\Maintenance\Models;

use App\Domains\Asset\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetIncident extends Model
{
    public const TYPE_DAMAGED = 'damaged';
    public const TYPE_LOST = 'lost';
    public const TYPE_STOLEN = 'stolen';
    public const TYPE_DESTROYED = 'destroyed';

    public const TYPES = [self::TYPE_DAMAGED, self::TYPE_LOST, self::TYPE_STOLEN, self::TYPE_DESTROYED];

    public const STATUS_OPEN = 'open';
    public const STATUS_INVESTIGATING = 'investigating';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [self::STATUS_OPEN, self::STATUS_INVESTIGATING, self::STATUS_RESOLVED, self::STATUS_CLOSED];

    protected $fillable = [
        'asset_id', 'incident_type', 'description', 'incident_date',
        'reported_by', 'status', 'resolution',
    ];

    protected $casts = ['incident_date' => 'date'];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }
}

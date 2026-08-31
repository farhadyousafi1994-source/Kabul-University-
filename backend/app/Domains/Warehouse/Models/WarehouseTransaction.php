<?php

namespace App\Domains\Warehouse\Models;

use App\Domains\Asset\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseTransaction extends Model
{
    public const TYPE_IN = 'IN';
    public const TYPE_OUT = 'OUT';
    public const TYPE_TRANSFER = 'TRANSFER';
    public const TYPE_ADJUSTMENT = 'ADJUSTMENT';

    public const TYPES = [self::TYPE_IN, self::TYPE_OUT, self::TYPE_TRANSFER, self::TYPE_ADJUSTMENT];

    protected $fillable = [
        'asset_id', 'warehouse_id', 'type', 'quantity',
        'reference_type', 'reference_id', 'user_id', 'notes',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

<?php

namespace App\Domains\Audit\Models;

use App\Domains\Asset\Models\Asset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAuditItem extends Model
{
    public const VERIFIED = 'verified';
    public const MISSING = 'missing';
    public const WRONG_LOCATION = 'wrong_location';
    public const DAMAGED = 'damaged';

    public const VERIFICATIONS = [self::VERIFIED, self::MISSING, self::WRONG_LOCATION, self::DAMAGED];

    protected $fillable = ['asset_audit_id', 'asset_id', 'scanned_at', 'verification', 'notes'];

    protected $casts = ['scanned_at' => 'datetime'];

    public function audit(): BelongsTo
    {
        return $this->belongsTo(AssetAudit::class, 'asset_audit_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}

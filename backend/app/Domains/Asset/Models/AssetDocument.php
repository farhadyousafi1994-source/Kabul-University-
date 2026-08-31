<?php

namespace App\Domains\Asset\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetDocument extends Model
{
    public const KIND_INVOICE = 'invoice';
    public const KIND_WARRANTY = 'warranty';
    public const KIND_MAINTENANCE = 'maintenance';
    public const KIND_DISPOSAL = 'disposal';
    public const KIND_OTHER = 'other';

    public const KINDS = [
        self::KIND_INVOICE,
        self::KIND_WARRANTY,
        self::KIND_MAINTENANCE,
        self::KIND_DISPOSAL,
        self::KIND_OTHER,
    ];

    protected $fillable = ['asset_id', 'kind', 'filename', 'path', 'mime', 'size', 'created_by'];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

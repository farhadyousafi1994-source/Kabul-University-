<?php

namespace App\Domains\Asset\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetImage extends Model
{
    protected $fillable = ['asset_id', 'filename', 'path', 'mime', 'size', 'created_by'];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

<?php

namespace App\Domains\System\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Module 29 — A backup snapshot kept on the server.
 */
class Backup extends Model
{
    public const KIND_MANUAL = 'manual';
    public const KIND_SCHEDULED = 'scheduled';
    public const KIND_PRE_RESTORE = 'pre_restore';

    public const FORMAT_SQLITE = 'sqlite';
    public const FORMAT_JSON = 'json';

    protected $fillable = [
        'filename', 'disk', 'path', 'driver', 'format', 'kind', 'size', 'created_by',
    ];

    protected $casts = [
        'size' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'created_by');
    }

    public function scopeLatestFirst($query)
    {
        return $query->orderByDesc('created_at')->orderByDesc('id');
    }

    /** Human-readable size, e.g. "504.0 KB". */
    public function getSizeHumanAttribute(): string
    {
        $bytes = (int) $this->size;
        if ($bytes <= 0) {
            return '0 KB';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = min((int) floor(log($bytes) / log(1024)), count($units) - 1);

        return number_format($bytes / 1024 ** $i, $i === 0 ? 0 : 1).' '.$units[$i];
    }
}

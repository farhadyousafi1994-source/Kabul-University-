<?php

namespace App\Domains\System\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A report a user saved from the Advanced Report Generator.
 *
 * `query` holds the NORMALISED Report Query Object — the version that already
 * passed the catalog allowlist — so a report saved years ago can never smuggle
 * in a data source or a field the catalog no longer allows. It is re-validated
 * against the *current* permissions on every run.
 */
class SavedReport extends Model
{
    protected $fillable = [
        'name', 'description', 'question', 'module', 'query',
        'chart_type', 'locale', 'is_shared', 'created_by',
        'last_run_at', 'run_count',
    ];

    protected $casts = [
        'query' => 'array',
        'is_shared' => 'boolean',
        'run_count' => 'integer',
        'last_run_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(ReportSchedule::class);
    }

    /** Reports the user owns, plus the ones colleagues shared. */
    public function scopeVisibleTo($query, User $user)
    {
        return $query->where(fn ($q) => $q->where('created_by', $user->id)->orWhere('is_shared', true));
    }
}

<?php

namespace App\Domains\Asset\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetLocationHistory extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'asset_id', 'campus_id', 'faculty_id', 'department_id',
        'building_id', 'floor_id', 'room_id', 'moved_by', 'moved_at', 'reason',
    ];

    protected $casts = ['moved_at' => 'datetime'];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function mover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'moved_by');
    }
}

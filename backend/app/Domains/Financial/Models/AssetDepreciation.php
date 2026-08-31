<?php

namespace App\Domains\Financial\Models;

use App\Domains\Asset\Models\Asset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetDepreciation extends Model
{
    protected $fillable = [
        'asset_id', 'method_id', 'period', 'original_value', 'salvage_value',
        'useful_life', 'annual_depreciation', 'accumulated_depreciation', 'book_value',
    ];

    protected $casts = [
        'original_value' => 'decimal:2',
        'salvage_value' => 'decimal:2',
        'annual_depreciation' => 'decimal:2',
        'accumulated_depreciation' => 'decimal:2',
        'book_value' => 'decimal:2',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function method(): BelongsTo
    {
        return $this->belongsTo(DepreciationMethod::class, 'method_id');
    }
}

<?php

namespace App\Domains\Procurement\Models;

use App\Domains\Asset\Models\AssetCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderItem extends Model
{
    protected $fillable = [
        'purchase_order_id', 'asset_category_id', 'name', 'brand', 'model',
        'quantity', 'unit_price', 'received_quantity',
    ];

    protected $casts = ['unit_price' => 'decimal:2'];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'asset_category_id');
    }
}

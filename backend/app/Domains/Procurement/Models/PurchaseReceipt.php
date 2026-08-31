<?php

namespace App\Domains\Procurement\Models;

use App\Domains\Warehouse\Models\Warehouse;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReceipt extends Model
{
    protected $fillable = [
        'receipt_number', 'purchase_order_id', 'warehouse_id',
        'received_by', 'received_date', 'notes',
    ];

    protected $casts = ['received_date' => 'date'];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}

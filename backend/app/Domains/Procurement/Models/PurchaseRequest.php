<?php

namespace App\Domains\Procurement\Models;

use App\Domains\Organization\Models\Department;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseRequest extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_ORDERED = 'ordered';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_SUBMITTED, self::STATUS_APPROVED, self::STATUS_REJECTED, self::STATUS_ORDERED];

    protected $fillable = ['pr_number', 'requested_by', 'department_id', 'supplier_id', 'status', 'notes'];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}

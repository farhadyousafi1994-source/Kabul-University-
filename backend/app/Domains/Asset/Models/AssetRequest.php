<?php

namespace App\Domains\Asset\Models;

use App\Domains\Organization\Models\Department;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetRequest extends Model
{
    public const TYPE_NEW = 'new_asset';
    public const TYPE_TEMPORARY = 'temporary_asset';
    public const TYPE_REPLACEMENT = 'replacement_asset';
    public const TYPE_REPAIR = 'repair_request';

    public const TYPES = [self::TYPE_NEW, self::TYPE_TEMPORARY, self::TYPE_REPLACEMENT, self::TYPE_REPAIR];

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_DEPARTMENT_APPROVAL = 'department_approval';
    public const STATUS_MANAGER_REVIEW = 'manager_review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [
        self::STATUS_DRAFT, self::STATUS_SUBMITTED, self::STATUS_DEPARTMENT_APPROVAL,
        self::STATUS_MANAGER_REVIEW, self::STATUS_APPROVED, self::STATUS_REJECTED,
        self::STATUS_COMPLETED,
    ];

    protected $fillable = [
        'request_number', 'requester_id', 'department_id', 'request_type',
        'asset_category_id', 'quantity', 'reason', 'status',
    ];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'asset_category_id');
    }
}

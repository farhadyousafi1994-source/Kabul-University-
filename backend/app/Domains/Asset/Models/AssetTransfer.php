<?php

namespace App\Domains\Asset\Models;

use App\Domains\Organization\Models\Building;
use App\Domains\Organization\Models\Campus;
use App\Domains\Organization\Models\Department;
use App\Domains\Organization\Models\Faculty;
use App\Domains\Organization\Models\Floor;
use App\Domains\Organization\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetTransfer extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_REQUESTED = 'requested';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_IN_TRANSIT = 'in_transit';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_DRAFT, self::STATUS_REQUESTED, self::STATUS_APPROVED,
        self::STATUS_IN_TRANSIT, self::STATUS_COMPLETED, self::STATUS_REJECTED,
    ];

    protected $fillable = [
        'asset_id',
        'from_campus_id', 'from_faculty_id', 'from_department_id',
        'from_building_id', 'from_floor_id', 'from_room_id',
        'to_campus_id', 'to_faculty_id', 'to_department_id',
        'to_building_id', 'to_floor_id', 'to_room_id',
        'requested_by', 'approved_by', 'transfer_date', 'status', 'notes',
    ];

    protected $casts = ['transfer_date' => 'date'];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function fromCampus(): BelongsTo { return $this->belongsTo(Campus::class, 'from_campus_id'); }
    public function fromFaculty(): BelongsTo { return $this->belongsTo(Faculty::class, 'from_faculty_id'); }
    public function fromDepartment(): BelongsTo { return $this->belongsTo(Department::class, 'from_department_id'); }
    public function fromBuilding(): BelongsTo { return $this->belongsTo(Building::class, 'from_building_id'); }
    public function fromFloor(): BelongsTo { return $this->belongsTo(Floor::class, 'from_floor_id'); }
    public function fromRoom(): BelongsTo { return $this->belongsTo(Room::class, 'from_room_id'); }
    public function toCampus(): BelongsTo { return $this->belongsTo(Campus::class, 'to_campus_id'); }
    public function toFaculty(): BelongsTo { return $this->belongsTo(Faculty::class, 'to_faculty_id'); }
    public function toDepartment(): BelongsTo { return $this->belongsTo(Department::class, 'to_department_id'); }
    public function toBuilding(): BelongsTo { return $this->belongsTo(Building::class, 'to_building_id'); }
    public function toFloor(): BelongsTo { return $this->belongsTo(Floor::class, 'to_floor_id'); }
    public function toRoom(): BelongsTo { return $this->belongsTo(Room::class, 'to_room_id'); }
}

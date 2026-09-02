<?php

namespace App\Domains\HR\Models;

use App\Domains\Asset\Models\Asset;
use App\Domains\Organization\Models\Department;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Employee — a dedicated HR entity, deliberately separate from User.
 *
 * A User is an authentication account; an Employee is a staff profile that
 * may optionally be linked to a user account through `user_id`. Assets are
 * assigned directly to employees (`assets.employee_id`).
 */
class Employee extends Model
{
    use HasFactory, SoftDeletes;

    public const TYPE_FULL_TIME = 'full_time';
    public const TYPE_PART_TIME = 'part_time';
    public const TYPE_CONTRACT = 'contract';

    public const EMPLOYMENT_TYPES = [
        self::TYPE_FULL_TIME,
        self::TYPE_PART_TIME,
        self::TYPE_CONTRACT,
    ];

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_ON_LEAVE = 'on_leave';

    public const STATUSES = [
        self::STATUS_ACTIVE,
        self::STATUS_INACTIVE,
        self::STATUS_ON_LEAVE,
    ];

    protected $fillable = [
        'employee_code', 'first_name', 'last_name', 'email', 'phone',
        'department_id', 'position', 'job_title', 'employment_type',
        'status', 'hire_date', 'manager_id', 'address', 'notes', 'user_id',
    ];

    protected $casts = [
        'hire_date' => 'date',
    ];

    protected $appends = ['full_name'];

    // -------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }

    public function subordinates(): HasMany
    {
        return $this->hasMany(self::class, 'manager_id');
    }

    /** Optional linked authentication account. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Assets currently assigned to this employee. */
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    // -------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }

    // -------------------------------------------------------------------
    // Query scopes
    // -------------------------------------------------------------------

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (! $term) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $like = '%'.$term.'%';
            $q->where('employee_code', 'like', $like)
                ->orWhere('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhereRaw("(first_name || ' ' || last_name) LIKE ?", [$like])
                ->orWhere('email', 'like', $like)
                ->orWhere('phone', 'like', $like)
                ->orWhere('position', 'like', $like);
        });
    }

    public function scopeFilterDepartment(Builder $query, ?int $departmentId): Builder
    {
        return $departmentId ? $query->where('department_id', $departmentId) : $query;
    }

    public function scopeFilterStatus(Builder $query, ?string $status): Builder
    {
        return $status ? $query->where('status', $status) : $query;
    }

    public function scopeFilterEmploymentType(Builder $query, ?string $type): Builder
    {
        return $type ? $query->where('employment_type', $type) : $query;
    }

    public function scopeSort(Builder $query, ?string $sort, ?string $direction): Builder
    {
        $direction = strtolower((string) $direction) === 'desc' ? 'desc' : 'asc';

        $column = match ($sort) {
            'employee_code' => 'employee_code',
            'department_name' => 'department_id',
            'position' => 'position',
            'employment_type' => 'employment_type',
            'status' => 'status',
            'hire_date' => 'hire_date',
            'created_at' => 'created_at',
            default => 'first_name',
        };

        return $query->orderBy($column, $direction)->orderBy('id');
    }

    /**
     * Generate the next sequential employee code (EMP-0001, EMP-0002, …).
     */
    public static function nextCode(): string
    {
        $last = static::withTrashed()
            ->where('employee_code', 'like', 'EMP-%')
            ->orderByRaw('LENGTH(employee_code) DESC')
            ->orderByDesc('employee_code')
            ->value('employee_code');

        $number = $last ? ((int) preg_replace('/\D+/', '', $last)) + 1 : 1;

        return sprintf('EMP-%04d', $number);
    }
}

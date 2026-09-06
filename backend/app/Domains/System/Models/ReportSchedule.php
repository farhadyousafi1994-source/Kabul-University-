<?php

namespace App\Domains\System\Models;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Automatic delivery of a saved report: daily, weekly, monthly or quarterly,
 * as a system notification, an email or a file in the download centre.
 */
class ReportSchedule extends Model
{
    public const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'];

    public const DELIVERIES = ['notification', 'email', 'download'];

    public const FORMATS = ['pdf', 'excel', 'csv'];

    protected $fillable = [
        'saved_report_id', 'frequency', 'day_of_week', 'day_of_month', 'time_of_day',
        'delivery', 'recipients', 'format', 'active', 'next_run_at', 'last_run_at', 'created_by',
    ];

    protected $casts = [
        'active' => 'boolean',
        'day_of_week' => 'integer',
        'day_of_month' => 'integer',
        'next_run_at' => 'datetime',
        'last_run_at' => 'datetime',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(SavedReport::class, 'saved_report_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Next fire time for this schedule, from `$from`. */
    public static function nextRun(
        string $frequency,
        string $timeOfDay = '08:00',
        ?int $dayOfWeek = 1,
        ?int $dayOfMonth = 1,
        ?CarbonImmutable $from = null,
    ): CarbonImmutable {
        $from ??= CarbonImmutable::now();
        [$hour, $minute] = array_pad(array_map('intval', explode(':', $timeOfDay)), 2, 0);
        $next = $from->setTime($hour, $minute);

        return match ($frequency) {
            'weekly' => $next->next($dayOfWeek ?? 1),
            'monthly' => $next->addMonthNoOverflow()->setDay(min(max($dayOfMonth ?? 1, 1), 28)),
            'quarterly' => $next->addMonthsNoOverflow(3)->setDay(min(max($dayOfMonth ?? 1, 1), 28)),
            default => $next->lessThanOrEqualTo($from) ? $next->addDay() : $next,
        };
    }
}

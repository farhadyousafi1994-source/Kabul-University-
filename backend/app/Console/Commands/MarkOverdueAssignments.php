<?php

namespace App\Console\Commands;

use App\Domains\Asset\Services\AssignmentService;
use App\Domains\System\Services\NotificationService;
use App\Domains\Asset\Models\AssetAssignment;
use Illuminate\Console\Command;

class MarkOverdueAssignments extends Command
{
    protected $signature = 'assignment:mark-overdue';

    protected $description = 'Mark assignments whose expected return date has passed as overdue and notify assignees';

    public function handle(): int
    {
        $overdue = AssignmentService::markOverdue();

        // Notify the assignees' linked login accounts of newly overdue items
        // (employees without a login account have no inbox to notify).
        $assignments = AssetAssignment::where('status', AssetAssignment::STATUS_OVERDUE)
            ->with(['asset', 'employee.user'])
            ->whereHas('asset')
            ->get();

        foreach ($assignments as $assignment) {
            $userId = $assignment->employee?->user_id ?? $assignment->assigned_to_user_id;
            if (! $userId) {
                continue;
            }

            NotificationService::send(
                (int) $userId,
                'assignment_overdue',
                'Asset assignment overdue',
                "{$assignment->asset->name} ({$assignment->asset->asset_code}) was due for return on {$assignment->expected_return_date?->toDateString()}.",
                'schedule',
            );
        }

        $this->info("Marked {$overdue} assignments as overdue.");

        return self::SUCCESS;
    }
}

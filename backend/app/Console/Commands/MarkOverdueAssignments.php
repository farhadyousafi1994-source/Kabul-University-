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

        // Notify assignees of newly overdue items.
        $assignments = AssetAssignment::where('status', AssetAssignment::STATUS_OVERDUE)
            ->with('asset')
            ->whereHas('asset')
            ->get();

        foreach ($assignments as $assignment) {
            NotificationService::send(
                $assignment->assigned_to_user_id,
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

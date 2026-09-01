<?php

namespace App\Console\Commands;

use App\Domains\System\Models\Backup;
use App\Domains\System\Services\BackupService;
use Illuminate\Console\Command;

/**
 * Module 29 — Scheduled backup.
 *
 *   php artisan backup:run                 # nightly snapshot (cron/scheduler)
 *   php artisan backup:run --format=json   # portable, restorable dump
 *   php artisan backup:run --keep=30       # prune everything beyond 30 files
 */
class RunBackup extends Command
{
    protected $signature = 'backup:run {--format= : sqlite (database copy) or json (portable dump)} {--keep= : Maximum number of snapshots to retain}';

    protected $description = 'Create a system backup snapshot and prune old ones (3-2-1 retention policy)';

    public function handle(): int
    {
        $format = $this->option('format') ?: BackupService::nativeFormat();
        $keep = (int) ($this->option('keep') ?: config('backup.keep', 30));
        $keep = $keep > 0 ? $keep : 30;

        $backup = BackupService::create(Backup::KIND_SCHEDULED, $format);

        $this->info("Backup created: {$backup->filename} ({$backup->size_human})");

        $pruned = BackupService::prune($keep);
        if ($pruned > 0) {
            $this->info("Pruned {$pruned} backup(s) beyond the retention limit of {$keep}.");
        }

        return self::SUCCESS;
    }
}

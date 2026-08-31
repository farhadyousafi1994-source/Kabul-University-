<?php

namespace App\Console\Commands;

use App\Domains\Financial\Services\DepreciationService;
use Illuminate\Console\Command;

class RunMonthlyDepreciation extends Command
{
    protected $signature = 'asset:depreciate {--period= : YYYY-MM period to calculate}';

    protected $description = 'Calculate monthly depreciation for all active assets';

    public function handle(DepreciationService $service): int
    {
        $count = $service->runMonthly($this->option('period'));

        $this->info("Monthly depreciation calculated for {$count} assets.");

        return self::SUCCESS;
    }
}

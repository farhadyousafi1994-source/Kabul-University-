<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| KU-AMS scheduled tasks
|--------------------------------------------------------------------------
*/

// Monthly depreciation batch (1st of the month at 02:00)
Schedule::command('asset:depreciate')->monthlyOn(1, '02:00');

// Warranty expiry + scheduled maintenance notifications (daily 07:00)
Schedule::command('notify:maintenance')->dailyAt('07:00');

// Overdue assignment detection (daily 08:00)
Schedule::command('assignment:mark-overdue')->dailyAt('08:00');

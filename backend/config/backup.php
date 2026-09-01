<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Backup & Disaster Recovery (Module 29)
    |--------------------------------------------------------------------------
    |
    | Snapshots are written to the configured disk/directory. On SQLite the
    | snapshot is a byte-for-byte copy of the database file; on MySQL and
    | PostgreSQL it is a portable JSON dump that can also be restored from the
    | UI. `keep` is the retention count applied by `php artisan backup:run`.
    |
    */

    'disk' => env('BACKUP_DISK', 'local'),

    'directory' => env('BACKUP_DIRECTORY', 'backups'),

    'keep' => (int) env('BACKUP_KEEP', 30),

    // Nightly snapshot — see routes/console.php.
    'scheduled_at' => env('BACKUP_SCHEDULED_AT', '02:30'),
];

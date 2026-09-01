<?php

namespace App\Domains\System\Services;

use App\Domains\System\Models\Backup;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Module 29 — Backup & disaster recovery.
 *
 * Two snapshot formats, one contract:
 *
 *   sqlite — a byte-for-byte copy of the SQLite database file (fast, exact,
 *            restored with a file copy as described in docs/OPERATIONS.md).
 *   json   — a portable dump of every application table: `['format' => 'ku-ams-backup',
 *            'tables' => [table => rows]]`. Driver independent and uploadable
 *            from the UI, which is how in-app restore and "clean start" work.
 *
 * Restore is deliberately conservative: framework/session tables are never
 * touched and a safety snapshot is taken before a single row is replaced.
 */
class BackupService
{
    public const DUMP_FORMAT = 'ku-ams-backup';
    public const DUMP_VERSION = 1;

    public const DISK = 'local';
    public const DIRECTORY = 'backups';

    /**
     * Tables a restore must never overwrite: sessions keep the operator logged
     * in, the backup index keeps pointing at real files, and the remaining
     * ones are framework plumbing rather than application data.
     */
    public const PROTECTED_TABLES = [
        'backups',
        'sessions',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'migrations',
        'password_reset_tokens',
        'personal_access_tokens',
        'sqlite_sequence',
    ];

    /**
     * Tables preserved by the "clean start" template: people, the organisation
     * tree, master data and settings. Everything else is emptied.
     */
    public const KEPT_IN_FRESH_START = [
        'users', 'roles', 'permissions', 'model_has_roles', 'model_has_permissions', 'role_has_permissions',
        'settings',
        'campuses', 'faculties', 'departments', 'buildings', 'floors', 'rooms',
        'asset_categories', 'asset_subcategories', 'suppliers', 'warehouses', 'depreciation_methods',
    ];

    public static function disk(): Filesystem
    {
        return Storage::disk((string) config('backup.disk', self::DISK));
    }

    /**
     * Directory (relative to the backup disk) where snapshots are stored.
     */
    public static function directory(): string
    {
        return trim((string) config('backup.directory', self::DIRECTORY), '/');
    }

    /**
     * Backup index plus the summary shown on the page hero.
     *
     * @return array{rows: \Illuminate\Database\Eloquent\Collection, meta: array<string, mixed>}
     */
    public static function index(): array
    {
        // Drop rows whose file has disappeared (manual pruning, volume loss).
        $rows = Backup::query()->latestFirst()->get();

        $total = (int) $rows->sum('size');
        $last = $rows->first();

        return [
            'rows' => $rows,
            'meta' => [
                'count' => $rows->count(),
                'total_size' => $total,
                'total_size_human' => $last ? self::humanSize($total) : '0 KB',
                'last_backup' => $last ? [
                    'id' => $last->id,
                    'filename' => $last->filename,
                    'size' => (int) $last->size,
                    'created_at' => $last->created_at?->toJSON(),
                ] : null,
            ],
        ];
    }

    /**
     * Create a snapshot. `format` defaults to the live driver's native format
     * (SQLite copies the database file, everything else dumps JSON).
     */
    public static function create(string $kind = Backup::KIND_MANUAL, ?string $format = null): Backup
    {
        $driver = DB::connection()->getDriverName();
        $format ??= $driver === 'sqlite' ? Backup::FORMAT_SQLITE : Backup::FORMAT_JSON;

        $stamp = now()->format('Ymd-His');
        $extension = $format === Backup::FORMAT_JSON ? 'json' : 'sqlite';
        $directory = self::directory();

        // Two snapshots started in the same second (a manual backup and the
        // automatic pre-restore safety copy) must not overwrite each other.
        $suffix = '';
        for ($i = 2; self::disk()->exists($directory."/backup-{$stamp}{$suffix}.{$extension}"); $i++) {
            $suffix = '-'.$i;
        }

        $filename = "backup-{$stamp}{$suffix}.{$extension}";
        $path = $directory.'/'.$filename;

        if ($format === Backup::FORMAT_SQLITE) {
            self::copySqliteDatabase($path);
        } else {
            self::disk()->put($path, json_encode(self::dump(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        return Backup::create([
            'filename' => $filename,
            'disk' => (string) config('backup.disk', self::DISK),
            'path' => $path,
            'driver' => $driver,
            'format' => $format,
            'kind' => $kind,
            'size' => self::disk()->size($path),
            'created_by' => auth('sanctum')->id(),
        ]);
    }

    /**
     * Every application table as rows — the portable snapshot payload.
     *
     * @param  list<string>|null  $only
     * @return array<string, mixed>
     */
    public static function dump(?array $only = null): array
    {
        $tables = [];
        foreach (self::tableNames() as $table) {
            if ($only !== null && ! in_array($table, $only, true)) {
                continue;
            }
            $tables[$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
        }

        return [
            'format' => self::DUMP_FORMAT,
            'version' => self::DUMP_VERSION,
            'kind' => 'full',
            'generated_at' => now()->toJSON(),
            'driver' => DB::connection()->getDriverName(),
            'tables' => $tables,
        ];
    }

    /**
     * "Clean start" payload: users, organisation, master data and settings are
     * kept; every operational record is emptied.
     *
     * @return array<string, mixed>
     */
    public static function freshTemplate(): array
    {
        $dump = self::dump(self::KEPT_IN_FRESH_START);
        $dump['kind'] = 'fresh-start';

        // Present every cleared table explicitly so the file documents itself.
        foreach (self::tableNames() as $table) {
            $dump['tables'][$table] ??= [];
        }
        ksort($dump['tables']);

        return $dump;
    }

    /**
     * Replace every application record with the contents of an uploaded dump.
     *
     * @return array{tables: int, rows: int, safety_backup: Backup}
     */
    public static function restore(array $dump): array
    {
        if (! isset($dump['tables']) || ! is_array($dump['tables']) || $dump['tables'] === []) {
            throw new RuntimeException('The file is not a valid KU-AMS backup snapshot.');
        }

        // Whatever happens next, the current state stays recoverable.
        $safety = self::create(Backup::KIND_PRE_RESTORE, self::nativeFormat());

        $existing = array_flip(self::tableNames());
        $tables = 0;
        $rows = 0;

        self::withoutForeignKeys(function () use ($dump, $existing, &$tables, &$rows) {
            DB::transaction(function () use ($dump, $existing, &$tables, &$rows) {
                foreach ($dump['tables'] as $table => $records) {
                    $table = (string) $table;
                    if (! isset($existing[$table]) || ! is_array($records)) {
                        continue;
                    }

                    DB::table($table)->delete();

                    $records = array_values(array_filter($records, fn ($r) => is_array($r)));
                    if ($records !== []) {
                        $columns = self::columnsOf($table);
                        foreach (array_chunk($records, 200) as $chunk) {
                            $payload = array_values(array_filter(
                                array_map(fn (array $record) => self::filterColumns($record, $columns), $chunk),
                            ));
                            if ($payload === []) {
                                continue;
                            }
                            DB::table($table)->insert($payload);
                            $rows += count($payload);
                        }
                    }

                    self::resetAutoIncrement($table);
                    $tables++;
                }
            });
        });

        ActivityLogService::record('restored', 'Backup', Backup::class, $safety->id, $safety->filename, null, [
            'tables' => $tables,
            'rows' => $rows,
        ]);

        return ['tables' => $tables, 'rows' => $rows, 'safety_backup' => $safety];
    }

    /**
     * Forget a backup and delete its file.
     */
    public static function delete(Backup $backup): void
    {
        ActivityLogService::record('deleted', 'Backup', Backup::class, $backup->id, $backup->filename);

        self::disk()->delete($backup->path);
        $backup->delete();
    }

    /**
     * Keep only the newest `$keep` snapshots (retention policy).
     */
    public static function prune(int $keep = 30): int
    {
        $stale = Backup::query()->latestFirst()->skip(max(0, $keep))->get();
        foreach ($stale as $backup) {
            self::delete($backup);
        }

        return $stale->count();
    }

    /**
     * Absolute path of a backup file (for streaming downloads).
     */
    public static function absolutePath(Backup $backup): string
    {
        return self::disk()->path($backup->path);
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    public static function nativeFormat(): string
    {
        return DB::connection()->getDriverName() === 'sqlite' ? Backup::FORMAT_SQLITE : Backup::FORMAT_JSON;
    }

    /**
     * @return list<string>
     */
    public static function tableNames(): array
    {
        return collect(Schema::getTables())
            ->pluck('name')
            ->filter(fn (string $table) => ! in_array($table, self::PROTECTED_TABLES, true))
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    protected static function columnsOf(string $table): array
    {
        return collect(Schema::getColumns($table))->pluck('name')->all();
    }

    /**
     * @param  array<string, mixed>  $record
     * @param  list<string>  $columns
     * @return array<string, mixed>
     */
    protected static function filterColumns(array $record, array $columns): array
    {
        $row = array_intersect_key($record, array_flip($columns));

        // Primary keys are restored as-is (foreign keys rely on them); only a
        // missing/null id is dropped so the database assigns its own value.
        if (array_key_exists('id', $row) && ($row['id'] === null || $row['id'] === '')) {
            unset($row['id']);
        }

        return $row;
    }

    protected static function resetAutoIncrement(string $table): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement("DELETE FROM sqlite_sequence WHERE name = '".str_replace("'", "''", $table)."'");
        }
    }

    protected static function copySqliteDatabase(string $path): void
    {
        $source = (string) config('database.connections.sqlite.database');
        if ($source === '' || ! is_file($source)) {
            throw new RuntimeException('The SQLite database file could not be located.');
        }

        // Flush the write-ahead log so the copy is a complete, standalone snapshot.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA wal_checkpoint(TRUNCATE)');
        }

        $handle = fopen($source, 'rb');
        if ($handle === false) {
            throw new RuntimeException('The database file could not be read.');
        }

        self::disk()->writeStream($path, $handle);

        if (is_resource($handle)) {
            fclose($handle);
        }
    }

    protected static function withoutForeignKeys(callable $callback): void
    {
        $driver = DB::connection()->getDriverName();

        try {
            match ($driver) {
                'sqlite' => DB::statement('PRAGMA foreign_keys = OFF'),
                'mysql', 'mariadb' => DB::statement('SET FOREIGN_KEY_CHECKS=0'),
                'pgsql' => DB::statement('SET session_replication_role = replica'),
                default => null,
            };

            $callback();
        } finally {
            match ($driver) {
                'sqlite' => DB::statement('PRAGMA foreign_keys = ON'),
                'mysql', 'mariadb' => DB::statement('SET FOREIGN_KEY_CHECKS=1'),
                'pgsql' => DB::statement('SET session_replication_role = DEFAULT'),
                default => null,
            };
        }
    }

    public static function humanSize(int|float $bytes): string
    {
        $bytes = (float) $bytes;
        if ($bytes <= 0) {
            return '0 KB';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = min((int) floor(log($bytes) / log(1024)), count($units) - 1);

        return number_format($bytes / 1024 ** $i, $i === 0 ? 0 : 1).' '.$units[$i];
    }

    /**
     * Guard used by the restore request: a dump must look like one of ours.
     */
    public static function isValidDump(mixed $dump): bool
    {
        return is_array($dump)
            && isset($dump['tables'])
            && is_array($dump['tables'])
            && $dump['tables'] !== [];
    }
}

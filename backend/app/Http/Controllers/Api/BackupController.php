<?php

namespace App\Http\Controllers\Api;

use App\Domains\System\Models\Backup;
use App\Domains\System\Requests\BackupRestoreRequest;
use App\Domains\System\Resources\BackupResource;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\BackupService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Module 29 — Backup & disaster recovery.
 *
 *   GET    /api/backups                history + summary
 *   POST   /api/backups                create a snapshot (format: sqlite|json)
 *   GET    /api/backups/fresh-template  "clean start" JSON snapshot
 *   POST   /api/backups/restore        replace all records with a snapshot
 *   GET    /api/backups/{backup}/download  the backup file
 *   DELETE /api/backups/{backup}       forget a snapshot + delete its file
 */
class BackupController extends Controller
{
    public function index(): JsonResponse
    {
        ['rows' => $rows, 'meta' => $meta] = BackupService::index();

        return ApiResponse::success('Backups retrieved successfully.', BackupResource::collection($rows), $meta);
    }

    public function store(Request $request): JsonResponse
    {
        $format = $request->input('format') === Backup::FORMAT_JSON
            ? Backup::FORMAT_JSON
            : BackupService::nativeFormat();

        $backup = BackupService::create(Backup::KIND_MANUAL, $format);

        ActivityLogService::record('created', 'Backup', Backup::class, $backup->id, $backup->filename);

        return ApiResponse::success('Backup created successfully.', new BackupResource($backup), null, 201);
    }

    /**
     * "Clean start" file: users and lists kept, every record emptied.
     */
    public function freshTemplate()
    {
        $dump = BackupService::freshTemplate();
        $filename = 'ku-ams-fresh-start-'.now()->toDateString().'.json';

        return response()->streamDownload(function () use ($dump) {
            echo json_encode($dump, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }, $filename, [
            'Content-Type' => 'application/json; charset=utf-8',
        ]);
    }

    public function restore(BackupRestoreRequest $request): JsonResponse
    {
        try {
            $result = BackupService::restore($request->input('data'));
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage() ?: 'The backup could not be restored.', 422);
        }

        return ApiResponse::success('System restored successfully.', [
            'tables' => $result['tables'],
            'rows' => $result['rows'],
            'safety_backup' => new BackupResource($result['safety_backup']),
        ]);
    }

    public function download(Backup $backup): JsonResponse|BinaryFileResponse
    {
        $path = BackupService::absolutePath($backup);

        if (! is_file($path)) {
            return ApiResponse::error('Backup file is missing on the server.', 404);
        }

        return response()->download($path, $backup->filename, [
            'Content-Type' => $backup->format === Backup::FORMAT_JSON ? 'application/json; charset=utf-8' : 'application/x-sqlite3',
        ]);
    }

    public function destroy(Backup $backup): JsonResponse
    {
        BackupService::delete($backup);

        return ApiResponse::success('Backup deleted successfully.', ['id' => $backup->id]);
    }
}

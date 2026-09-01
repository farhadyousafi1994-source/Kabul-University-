<?php

namespace App\Domains\System\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Module 29 — Backup snapshot representation.
 */
class BackupResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var \App\Domains\System\Models\Backup $backup */
        $backup = $this->resource;

        return [
            'id' => $backup->id,
            'filename' => $backup->filename,
            'size' => (int) $backup->size,
            'size_human' => $backup->size_human,
            'driver' => $backup->driver,
            'format' => $backup->format,
            'kind' => $backup->kind,
            'created_by' => $backup->created_by,
            'created_at' => $backup->created_at?->toJSON(),
            'download_url' => route('backups.download', $backup, false),
        ];
    }
}

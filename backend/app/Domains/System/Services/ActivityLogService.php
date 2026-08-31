<?php

namespace App\Domains\System\Services;

use App\Domains\System\Models\ActivityLog;

/**
 * Module 21 — Activity logs & audit trail.
 * Every important domain action funnels through here so the trail is
 * complete, consistent and immutable (no update/delete paths).
 */
class ActivityLogService
{
    public static function record(
        string $action,
        string $module,
        ?string $entityType = null,
        ?int $entityId = null,
        ?string $entityLabel = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $userId = null,
    ): ActivityLog {
        $userId ??= auth('sanctum')->id();

        return ActivityLog::create([
            'user_id' => $userId,
            'action' => $action,
            'module' => $module,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'entity_label' => $entityLabel,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => request()->ip(),
        ]);
    }

    /**
     * Convenience: log a change with only the changed attributes.
     */
    public static function recordChanges(string $module, $model, array $changed, string $action = 'updated'): ActivityLog
    {
        return self::record(
            $action,
            $module,
            $model::class,
            $model->id,
            (string) ($model->name ?? $model->code ?? $model->id),
            null,
            $changed,
        );
    }
}

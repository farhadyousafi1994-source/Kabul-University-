<?php

namespace App\Domains\Organization\Services;

use App\Domains\System\Services\ActivityLogService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Shared CRUD business logic for the organization entities.
 * (Controllers stay thin; this service owns query building and logging.)
 */
class OrganizationService
{
    public function __construct(
        protected string $modelClass,
        protected string $module,
    ) {
    }

    public function query(array $filters = []): Builder
    {
        $query = $this->modelClass::query();

        if ($search = $filters['search'] ?? null) {
            $query->search($search);
        }

        if ($status = $filters['status'] ?? null) {
            $query->where('status', $status);
        }

        // Generic parent-scope filter (campus_id, faculty_id, …)
        foreach ($filters as $key => $value) {
            if (str_ends_with((string) $key, '_id') && $value !== null && $value !== '') {
                $query->where($key, (int) $value);
            }
        }

        return $query;
    }

    public function create(array $data): Model
    {
        $model = $this->modelClass::create($data);

        ActivityLogService::record('created', $this->module, $this->modelClass, $model->id, (string) $model->name);

        return $model;
    }

    public function update(Model $model, array $data): Model
    {
        $model->update($data);

        ActivityLogService::record('updated', $this->module, $this->modelClass, $model->id, (string) $model->name, null, $data);

        return $model->fresh();
    }

    public function archive(Model $model): void
    {
        $label = (string) $model->name;
        $model->delete();

        ActivityLogService::record('deleted', $this->module, $this->modelClass, $model->id, $label);
    }
}

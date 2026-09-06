<?php

namespace App\Http\Controllers\Api;

use App\Domains\System\Models\ReportSchedule;
use App\Domains\System\Models\SavedReport;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\Reports\ReportCatalog;
use App\Domains\System\Services\Reports\ReportQueryException;
use App\Domains\System\Services\Reports\ReportQueryValidator;
use App\Domains\System\Services\Reports\ReportRunner;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * ---------------------------------------------------------------------------
 * Module 23b — Advanced Report Generator
 * ---------------------------------------------------------------------------
 *
 *   GET    /api/reports/catalog             data sources this user may report on
 *   GET    /api/reports/lookups/{kind}      distinct filter values (allowlisted)
 *   POST   /api/reports/query/validate      normalise a request for the preview
 *   POST   /api/reports/query               run a report
 *   GET    /api/reports/saved               saved + shared reports
 *   POST   /api/reports/saved               save the current report
 *   PUT    /api/reports/saved/{id}          rename / re-share / replace the query
 *   DELETE /api/reports/saved/{id}          delete
 *   POST   /api/reports/saved/{id}/run      re-run (re-validated every time)
 *   GET    /api/reports/schedules           delivery schedules
 *   POST   /api/reports/schedules           schedule a saved report
 *   PUT    /api/reports/schedules/{id}      change or pause a schedule
 *   DELETE /api/reports/schedules/{id}      cancel a schedule
 *
 * Security model — the reason this controller is thin:
 *
 *   · the client sends a structured Report Query Object, never SQL;
 *   · `ReportQueryValidator` checks every id against the catalog allowlist and
 *     the caller's permissions (including `reports.view_financial`);
 *   · `ReportRunner` maps ids onto static SQL fragments, binds every value,
 *     adds the department scope for users without `reports.view_all_branches`
 *     and refuses anything that is not a single read-only SELECT.
 *
 * Mirrored 1:1 by frontend/mock-api/routes/reports.routes.js.
 */
class ReportGeneratorController extends Controller
{
    // ---------------------------------------------------------------- catalog

    public function catalog(Request $request): JsonResponse
    {
        $user = $request->user();
        $can = fn (string $permission) => $user->can($permission);

        return ApiResponse::success('Report catalog retrieved successfully.', array_merge(
            ReportCatalog::publicCatalog($can),
            [
                'permissions' => [
                    'generate' => $can('reports.generate'),
                    'export' => $can('reports.export'),
                    'schedule' => $can('reports.schedule'),
                    'manage' => $can('reports.manage'),
                    'financial' => $can('reports.view_financial'),
                    'allBranches' => $can('reports.view_all_branches'),
                ],
            ],
        ));
    }

    /** Distinct values for a filter — only from allowlisted table/column pairs. */
    public function lookup(string $kind): JsonResponse
    {
        $source = ReportCatalog::LOOKUPS[$kind] ?? null;

        if (! $source) {
            return ApiResponse::error('Unknown lookup list.', 404);
        }

        $values = DB::table($source['table'])
            ->select($source['column'].' as value')
            ->whereNotNull($source['column'])
            ->where($source['column'], '<>', '')
            ->distinct()
            ->orderBy($source['column'])
            ->limit(300)
            ->pluck('value')
            ->all();

        return ApiResponse::success('Lookup retrieved successfully.', ['kind' => $kind, 'values' => $values]);
    }

    // --------------------------------------------------------------- generate

    /** Dry run for the preview card: validated and normalised, never executed. */
    public function validateQuery(Request $request): JsonResponse
    {
        return $this->guard(function () use ($request) {
            $query = ReportQueryValidator::validate(
                $this->queryPayload($request),
                fn (string $permission) => $request->user()->can($permission),
            );

            return ApiResponse::success('Report request is valid.', [
                'query' => $query,
                'moduleLabelKey' => ReportCatalog::dataset($query['module'])['labelKey'],
            ]);
        });
    }

    public function run(Request $request): JsonResponse
    {
        return $this->guard(function () use ($request) {
            $user = $request->user();
            $can = fn (string $permission) => $user->can($permission);

            $query = ReportQueryValidator::validate($this->queryPayload($request), $can);

            return ApiResponse::success('Report generated successfully.', ReportRunner::run($query, $can, $user));
        });
    }

    // ---------------------------------------------------------- saved reports

    public function savedIndex(Request $request): JsonResponse
    {
        $reports = SavedReport::query()
            ->visibleTo($request->user())
            ->with('creator:id,name')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (SavedReport $report) => $this->serialiseSaved($report));

        return ApiResponse::success('Saved reports retrieved successfully.', ['data' => $reports]);
    }

    public function savedStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'question' => ['nullable', 'string', 'max:500'],
            'locale' => ['nullable', 'string', 'max:8'],
            'is_shared' => ['nullable', 'boolean'],
            'chart_type' => ['nullable', 'string', 'max:16'],
        ]);

        return $this->guard(function () use ($request, $data) {
            $user = $request->user();
            $query = ReportQueryValidator::validate(
                $this->queryPayload($request),
                fn (string $permission) => $user->can($permission),
            );

            $report = SavedReport::create([
                'name' => $data['name'],
                'description' => $data['description'] ?? '',
                'question' => $data['question'] ?? '',
                'module' => $query['module'],
                'query' => $query,
                'chart_type' => $data['chart_type'] ?? $query['chart'],
                'locale' => $data['locale'] ?? null,
                'is_shared' => (bool) ($data['is_shared'] ?? false),
                'created_by' => $user->id,
                'run_count' => 0,
            ]);

            ActivityLogService::record('created', 'Reports', SavedReport::class, $report->id, $report->name);

            return ApiResponse::success('Report saved successfully.', $this->serialiseSaved($report), null, 201);
        });
    }

    public function savedUpdate(Request $request, SavedReport $savedReport): JsonResponse
    {
        if (! $this->owns($request, $savedReport)) {
            return ApiResponse::error('You can only modify your own saved reports.', 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'question' => ['nullable', 'string', 'max:500'],
            'is_shared' => ['nullable', 'boolean'],
            'chart_type' => ['nullable', 'string', 'max:16'],
        ]);

        return $this->guard(function () use ($request, $savedReport, $data) {
            $query = $request->has('query')
                ? ReportQueryValidator::validate(
                    $this->queryPayload($request),
                    fn (string $permission) => $request->user()->can($permission),
                )
                : $savedReport->query;

            $savedReport->fill([
                'name' => $data['name'] ?? $savedReport->name,
                'description' => $data['description'] ?? $savedReport->description,
                'question' => $data['question'] ?? $savedReport->question,
                'module' => $query['module'] ?? $savedReport->module,
                'query' => $query,
                'chart_type' => $data['chart_type'] ?? ($query['chart'] ?? $savedReport->chart_type),
                'is_shared' => array_key_exists('is_shared', $data) ? (bool) $data['is_shared'] : $savedReport->is_shared,
            ])->save();

            ActivityLogService::record('updated', 'Reports', SavedReport::class, $savedReport->id, $savedReport->name);

            return ApiResponse::success('Report updated successfully.', $this->serialiseSaved($savedReport->fresh('creator')));
        });
    }

    public function savedDestroy(Request $request, SavedReport $savedReport): JsonResponse
    {
        if (! $this->owns($request, $savedReport)) {
            return ApiResponse::error('You can only delete your own saved reports.', 403);
        }

        $id = $savedReport->id;
        ActivityLogService::record('deleted', 'Reports', SavedReport::class, $id, $savedReport->name);
        $savedReport->delete();

        return ApiResponse::success('Report deleted successfully.', ['id' => $id]);
    }

    /** Re-run a saved report — permissions may have changed since it was saved. */
    public function savedRun(Request $request, SavedReport $savedReport): JsonResponse
    {
        $user = $request->user();

        if ($savedReport->created_by !== $user->id && ! $savedReport->is_shared && ! $user->can('reports.manage')) {
            return ApiResponse::error('This report has not been shared with you.', 403);
        }

        return $this->guard(function () use ($savedReport, $user) {
            $can = fn (string $permission) => $user->can($permission);
            $query = ReportQueryValidator::validate($savedReport->query ?? [], $can);
            $payload = ReportRunner::run($query, $can, $user);

            $savedReport->forceFill([
                'last_run_at' => now(),
                'run_count' => $savedReport->run_count + 1,
            ])->save();

            return ApiResponse::success('Report generated successfully.', array_merge($payload, [
                'saved_report' => $this->serialiseSaved($savedReport->fresh('creator')),
            ]));
        });
    }

    // -------------------------------------------------------------- schedules

    public function scheduleIndex(Request $request): JsonResponse
    {
        $user = $request->user();

        $schedules = ReportSchedule::query()
            ->with('report:id,name')
            ->when(! $user->can('reports.manage'), fn ($q) => $q->where('created_by', $user->id))
            ->orderBy('next_run_at')
            ->get()
            ->map(fn (ReportSchedule $schedule) => $this->serialiseSchedule($schedule));

        return ApiResponse::success('Schedules retrieved successfully.', ['data' => $schedules]);
    }

    public function scheduleStore(Request $request): JsonResponse
    {
        $data = $this->scheduleRules($request);

        $schedule = ReportSchedule::create(array_merge($data, [
            'active' => true,
            'created_by' => $request->user()->id,
            'next_run_at' => ReportSchedule::nextRun(
                $data['frequency'],
                $data['time_of_day'],
                $data['day_of_week'] ?? null,
                $data['day_of_month'] ?? null,
            ),
        ]));

        ActivityLogService::record('created', 'Reports', ReportSchedule::class, $schedule->id, 'Report schedule');

        return ApiResponse::success('Report scheduled successfully.', $this->serialiseSchedule($schedule->fresh('report')), null, 201);
    }

    public function scheduleUpdate(Request $request, ReportSchedule $reportSchedule): JsonResponse
    {
        if ($reportSchedule->created_by !== $request->user()->id && ! $request->user()->can('reports.manage')) {
            return ApiResponse::error('You can only modify your own schedules.', 403);
        }

        $data = $this->scheduleRules($request, partial: true);
        $reportSchedule->fill($data);
        $reportSchedule->next_run_at = ReportSchedule::nextRun(
            $reportSchedule->frequency,
            $reportSchedule->time_of_day,
            $reportSchedule->day_of_week,
            $reportSchedule->day_of_month,
        );
        $reportSchedule->save();

        return ApiResponse::success('Schedule updated successfully.', $this->serialiseSchedule($reportSchedule->fresh('report')));
    }

    public function scheduleDestroy(Request $request, ReportSchedule $reportSchedule): JsonResponse
    {
        if ($reportSchedule->created_by !== $request->user()->id && ! $request->user()->can('reports.manage')) {
            return ApiResponse::error('You can only cancel your own schedules.', 403);
        }

        $id = $reportSchedule->id;
        $reportSchedule->delete();

        return ApiResponse::success('Schedule cancelled successfully.', ['id' => $id]);
    }

    // ---------------------------------------------------------------- helpers

    /**
     * Run a closure, translating a catalog rejection into the standard error
     * envelope (422 with a field => messages map, or 403 for a permission).
     */
    private function guard(callable $callback): JsonResponse
    {
        try {
            return $callback();
        } catch (ReportQueryException $e) {
            return ApiResponse::error($e->getMessage(), $e->status, $e->errors ?: null);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function queryPayload(Request $request): array
    {
        $query = $request->input('query', $request->all());

        return is_array($query) ? $query : [];
    }

    private function owns(Request $request, SavedReport $report): bool
    {
        return $report->created_by === $request->user()->id || $request->user()->can('reports.manage');
    }

    /**
     * @return array<string, mixed>
     */
    private function scheduleRules(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        $data = $request->validate([
            'saved_report_id' => [$required, 'integer', 'exists:saved_reports,id'],
            'frequency' => [$required, 'string', 'in:'.implode(',', ReportSchedule::FREQUENCIES)],
            'day_of_week' => ['nullable', 'integer', 'between:0,6'],
            'day_of_month' => ['nullable', 'integer', 'between:1,28'],
            'time_of_day' => ['nullable', 'date_format:H:i'],
            'delivery' => ['nullable', 'string', 'in:'.implode(',', ReportSchedule::DELIVERIES)],
            'recipients' => ['nullable', 'string', 'max:500'],
            'format' => ['nullable', 'string', 'in:'.implode(',', ReportSchedule::FORMATS)],
            'active' => ['nullable', 'boolean'],
        ]);

        // Sensible fallbacks so a half-filled form still produces a valid plan.
        $data['time_of_day'] = $data['time_of_day'] ?? ($partial ? null : '08:00');
        $data['delivery'] = $data['delivery'] ?? ($partial ? null : 'notification');
        $data['format'] = $data['format'] ?? ($partial ? null : 'pdf');

        return array_filter($data, static fn ($value) => $value !== null);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiseSaved(SavedReport $report): array
    {
        return [
            'id' => $report->id,
            'name' => $report->name,
            'description' => $report->description ?? '',
            'question' => $report->question ?? '',
            'module' => $report->module,
            'query' => $report->query,
            'chart_type' => $report->chart_type ?? 'auto',
            'locale' => $report->locale,
            'is_shared' => (bool) $report->is_shared,
            'created_by' => $report->created_by,
            'created_by_name' => $report->creator?->name ?? '',
            'last_run_at' => $report->last_run_at?->toIso8601String(),
            'run_count' => (int) $report->run_count,
            'created_at' => $report->created_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiseSchedule(ReportSchedule $schedule): array
    {
        return [
            'id' => $schedule->id,
            'saved_report_id' => $schedule->saved_report_id,
            'report_name' => $schedule->report?->name ?? '',
            'frequency' => $schedule->frequency,
            'day_of_week' => $schedule->day_of_week,
            'day_of_month' => $schedule->day_of_month,
            'time_of_day' => $schedule->time_of_day,
            'delivery' => $schedule->delivery,
            'recipients' => $schedule->recipients ?? '',
            'format' => $schedule->format,
            'active' => (bool) $schedule->active,
            'next_run_at' => $schedule->next_run_at?->toIso8601String(),
            'last_run_at' => $schedule->last_run_at?->toIso8601String(),
            'created_at' => $schedule->created_at?->toIso8601String(),
        ];
    }
}

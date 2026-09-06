<?php

namespace App\Domains\System\Services\Reports;

use Carbon\CarbonImmutable;

/**
 * ---------------------------------------------------------------------------
 * Report query validator — the gate every report must pass
 * ---------------------------------------------------------------------------
 *
 * Turns whatever the client sent into a normalised Report Query Object, or
 * throws. Nothing downstream ever sees a raw client value:
 *
 *   1. `module` must exist in the catalog and the caller must hold the
 *      dataset's permission.
 *   2. Metrics, dimensions, fields, filters, the sort field and the date field
 *      must be ids the dataset declares — unknown ids are rejected, not
 *      ignored, so a typo can never silently widen a report.
 *   3. Financial metrics and filters require `reports.view_financial`.
 *   4. Operators must be allowed for the field's type; enum filters must use a
 *      listed option; `between` needs exactly two values.
 *   5. The row limit is clamped, and an under-specified request falls back to
 *      the dataset's own defaults rather than to "everything".
 *
 * The result contains ids only. `ReportRunner` maps those ids onto the static
 * SQL fragments in `ReportCatalog`; no client string is ever concatenated into
 * a statement.
 */
class ReportQueryValidator
{
    /**
     * @param  array<string, mixed>  $raw
     * @param  callable(string): bool  $can
     * @return array<string, mixed>
     *
     * @throws ReportQueryException
     */
    public static function validate(array $raw, callable $can, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $errors = [];

        // ------------------------------------------------------------ module
        $module = is_string($raw['module'] ?? null) ? $raw['module'] : '';
        $ds = ReportCatalog::dataset($module);

        if (! $ds) {
            throw new ReportQueryException('Invalid report request.', [
                'module' => ['Unknown data source "'.$module.'".'],
            ]);
        }

        if (! empty($ds['permission']) && ! $can($ds['permission'])) {
            throw new ReportQueryException('You do not have permission to run this report.', [
                'module' => ['You may not report on this data source.'],
            ], 403);
        }

        $financial = $can('reports.view_financial');
        $mode = ($raw['mode'] ?? 'aggregate') === 'detail' ? 'detail' : 'aggregate';

        // ------------------------------------------------------------ metrics
        $metrics = [];
        foreach (self::stringList($raw['metrics'] ?? []) as $id) {
            $def = $ds['metrics'][$id] ?? null;
            if (! $def) {
                $errors['metrics'][] = 'Unknown metric "'.$id.'".';

                continue;
            }
            if (! empty($def['financial']) && ! $financial) {
                $errors['metrics'][] = 'You do not have permission to read financial values.';

                continue;
            }
            $metrics[] = $id;
        }

        // --------------------------------------------------------- dimensions
        $dimensions = [];
        foreach (self::stringList($raw['dimensions'] ?? []) as $id) {
            $isTime = in_array($id, ReportCatalog::TIME_DIMENSIONS, true);
            if (! $isTime && ! isset($ds['dimensions'][$id])) {
                $errors['dimensions'][] = 'Unknown grouping "'.$id.'".';

                continue;
            }
            $dimensions[] = $id;
        }
        $dimensions = array_slice(array_values(array_unique($dimensions)), 0, 2);

        // -------------------------------------------------------------- fields
        $fields = [];
        foreach (self::stringList($raw['fields'] ?? []) as $id) {
            $def = $ds['fields'][$id] ?? null;
            if (! $def) {
                $errors['fields'][] = 'Unknown column "'.$id.'".';

                continue;
            }
            if (! empty($def['financial']) && ! $financial) {
                continue;
            }
            $fields[] = $id;
        }

        // ---------------------------------------------------------- date field
        $dates = array_keys($ds['dates'] ?? []);
        $dateField = is_string($raw['dateField'] ?? null) ? $raw['dateField'] : null;
        if ($dateField !== null && ! in_array($dateField, $dates, true)) {
            $errors['dateField'][] = 'Unknown date field "'.$dateField.'".';
            $dateField = null;
        }
        $dateField ??= ($ds['defaultDate'] ?? ($dates[0] ?? null));

        // ------------------------------------------------------------- filters
        $rawFilters = is_array($raw['filters'] ?? null) ? $raw['filters'] : [];
        $filters = [];

        foreach ($rawFilters as $id => $spec) {
            if ($id === 'date_range') {
                continue;
            }

            $def = $ds['filters'][$id] ?? null;
            if (! $def) {
                $errors['filters'][] = 'Unknown filter "'.$id.'".';

                continue;
            }
            if (! empty($def['financial']) && ! $financial) {
                $errors['filters'][] = 'You do not have permission to filter on financial values.';

                continue;
            }

            $spec = is_array($spec) ? $spec : ['op' => 'eq', 'value' => $spec];
            $op = is_string($spec['op'] ?? null) ? $spec['op'] : 'eq';
            $type = $def['type'] ?? 'text';
            $allowed = ReportCatalog::OPERATORS[$type] ?? ReportCatalog::OPERATORS['text'];

            if (! in_array($op, $allowed, true)) {
                $errors['filters'][] = 'Operator "'.$op.'" is not allowed on "'.$id.'".';

                continue;
            }

            if (in_array($op, ['is_empty', 'is_not_empty'], true)) {
                $filters[$id] = ['op' => $op];

                continue;
            }

            $value = $spec['value'] ?? null;

            if ($op === 'between') {
                $pair = array_values(is_array($value) ? $value : []);
                if (count($pair) !== 2 || $pair[0] === null || $pair[1] === null) {
                    $errors['filters'][] = 'Filter "'.$id.'" needs two values.';

                    continue;
                }
                $filters[$id] = ['op' => $op, 'value' => [self::scalar($pair[0]), self::scalar($pair[1])]];

                continue;
            }

            if ($op === 'in') {
                $list = array_values(array_filter(
                    array_map([self::class, 'scalar'], is_array($value) ? $value : [$value]),
                    static fn ($v) => $v !== null && $v !== '',
                ));
                if (! $list) {
                    $errors['filters'][] = 'Filter "'.$id.'" needs at least one value.';

                    continue;
                }
                if (! empty($def['options'])) {
                    foreach ($list as $entry) {
                        if (! in_array($entry, $def['options'], true)) {
                            $errors['filters'][] = 'Value "'.$entry.'" is not allowed for "'.$id.'".';

                            continue 2;
                        }
                    }
                }
                $filters[$id] = ['op' => $op, 'value' => array_slice($list, 0, 50)];

                continue;
            }

            $scalar = self::scalar($value);
            if ($scalar === null || $scalar === '') {
                continue;
            }
            if (! empty($def['options']) && ! in_array($scalar, $def['options'], true)) {
                $errors['filters'][] = 'Value "'.$scalar.'" is not allowed for "'.$id.'".';

                continue;
            }
            $filters[$id] = ['op' => $op, 'value' => $scalar];
        }

        // ---------------------------------------------------------- date range
        $range = is_array($rawFilters['date_range'] ?? null) ? $rawFilters['date_range'] : [];
        $preset = is_string($range['preset'] ?? null) ? $range['preset'] : 'all_time';
        if (! in_array($preset, ReportCatalog::DATE_PRESETS, true)) {
            $errors['filters'][] = 'Unknown period "'.$preset.'".';
            $preset = 'all_time';
        }
        $dateRange = self::resolveDateRange($preset, $range, $now);

        // ---------------------------------------------------------- defaults
        // An under-specified request becomes the dataset's own default report
        // rather than an unbounded scan.
        $defaults = $ds['defaults'] ?? [];
        if ($mode === 'aggregate') {
            if (! $metrics) {
                $metrics = array_values(array_filter(
                    $defaults['metrics'] ?? [],
                    fn ($id) => isset($ds['metrics'][$id]) && (empty($ds['metrics'][$id]['financial']) || $financial),
                ));
            }
            if (! $dimensions) {
                $dimensions = array_slice($defaults['dimensions'] ?? [], 0, 2);
            }
            if (! $metrics) {
                $errors['metrics'][] = 'Select at least one calculation.';
            }
        } elseif (! $fields) {
            $fields = array_values(array_filter(
                $defaults['fields'] ?? [],
                fn ($id) => isset($ds['fields'][$id]) && (empty($ds['fields'][$id]['financial']) || $financial),
            ));
            if (! $fields) {
                $errors['fields'][] = 'Select at least one column.';
            }
        }

        // ------------------------------------------------------------- sorting
        $sort = null;
        $sortField = is_array($raw['sort'] ?? null) ? ($raw['sort']['field'] ?? null) : null;
        if (is_string($sortField) && $sortField !== '') {
            $sortable = $mode === 'aggregate' ? array_merge($metrics, $dimensions) : $fields;
            if (! in_array($sortField, $sortable, true)) {
                $errors['sort'][] = 'Cannot sort by "'.$sortField.'" — it is not part of this report.';
            } else {
                $direction = strtolower((string) ($raw['sort']['direction'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
                $sort = ['field' => $sortField, 'direction' => $direction];
            }
        }
        if (! $sort) {
            $fallback = $mode === 'aggregate' ? ($metrics[0] ?? null) : ($fields[0] ?? null);
            if ($fallback) {
                $sort = ['field' => $fallback, 'direction' => $mode === 'aggregate' ? 'desc' : 'asc'];
            }
        }

        // --------------------------------------------------------------- limit
        $limit = (int) ($raw['limit'] ?? 0);
        if ($limit <= 0) {
            $limit = $mode === 'detail' ? 100 : ReportCatalog::LIMITS['default'];
        }
        $limit = min($limit, ReportCatalog::LIMITS['max']);

        $chart = in_array($raw['chart'] ?? null, ReportCatalog::CHART_TYPES, true) ? $raw['chart'] : 'auto';

        if ($errors) {
            throw new ReportQueryException('Invalid report request.', $errors);
        }

        return [
            'module' => $module,
            'mode' => $mode,
            'metrics' => $mode === 'aggregate' ? array_values(array_unique($metrics)) : [],
            'dimensions' => $mode === 'aggregate' ? $dimensions : [],
            'fields' => $mode === 'detail' ? array_values(array_unique($fields)) : [],
            'dateField' => $dateField,
            'filters' => array_merge($filters, ['date_range' => $dateRange]),
            'dateRange' => $dateRange,
            'sort' => $sort,
            'limit' => $limit,
            'chart' => $chart,
        ];
    }

    /**
     * Resolve a named period into concrete ISO boundaries.
     *
     * @param  array<string, mixed>  $range
     * @return array{preset: string, from: ?string, to: ?string}
     */
    public static function resolveDateRange(string $preset, array $range, CarbonImmutable $now): array
    {
        $iso = static fn (CarbonImmutable $d) => $d->toIso8601String();

        return match ($preset) {
            'today' => ['preset' => $preset, 'from' => $iso($now->startOfDay()), 'to' => $iso($now->endOfDay())],
            'yesterday' => ['preset' => $preset, 'from' => $iso($now->subDay()->startOfDay()), 'to' => $iso($now->subDay()->endOfDay())],
            'this_week' => ['preset' => $preset, 'from' => $iso($now->startOfWeek()), 'to' => $iso($now->endOfWeek())],
            'last_week' => ['preset' => $preset, 'from' => $iso($now->subWeek()->startOfWeek()), 'to' => $iso($now->subWeek()->endOfWeek())],
            'this_month' => ['preset' => $preset, 'from' => $iso($now->startOfMonth()), 'to' => $iso($now->endOfMonth())],
            'last_month' => ['preset' => $preset, 'from' => $iso($now->subMonth()->startOfMonth()), 'to' => $iso($now->subMonth()->endOfMonth())],
            'this_quarter' => ['preset' => $preset, 'from' => $iso($now->startOfQuarter()), 'to' => $iso($now->endOfQuarter())],
            'this_year' => ['preset' => $preset, 'from' => $iso($now->startOfYear()), 'to' => $iso($now->endOfYear())],
            'last_year' => ['preset' => $preset, 'from' => $iso($now->subYear()->startOfYear()), 'to' => $iso($now->subYear()->endOfYear())],
            'last_7_days' => ['preset' => $preset, 'from' => $iso($now->subDays(7)->startOfDay()), 'to' => $iso($now->endOfDay())],
            'last_30_days' => ['preset' => $preset, 'from' => $iso($now->subDays(30)->startOfDay()), 'to' => $iso($now->endOfDay())],
            'last_90_days' => ['preset' => $preset, 'from' => $iso($now->subDays(90)->startOfDay()), 'to' => $iso($now->endOfDay())],
            'last_6_months' => ['preset' => $preset, 'from' => $iso($now->subMonths(6)->startOfDay()), 'to' => $iso($now->endOfDay())],
            'last_12_months' => ['preset' => $preset, 'from' => $iso($now->subMonths(12)->startOfDay()), 'to' => $iso($now->endOfDay())],
            'next_30_days' => ['preset' => $preset, 'from' => $iso($now->startOfDay()), 'to' => $iso($now->addDays(30)->endOfDay())],
            'next_90_days' => ['preset' => $preset, 'from' => $iso($now->startOfDay()), 'to' => $iso($now->addDays(90)->endOfDay())],
            'custom' => self::customRange($range),
            default => ['preset' => 'all_time', 'from' => null, 'to' => null],
        };
    }

    /**
     * @param  array<string, mixed>  $range
     * @return array{preset: string, from: ?string, to: ?string}
     */
    private static function customRange(array $range): array
    {
        $from = self::isoDate($range['from'] ?? null);
        $to = self::isoDate($range['to'] ?? null, endOfDay: true);

        if (! $from && ! $to) {
            return ['preset' => 'all_time', 'from' => null, 'to' => null];
        }

        return ['preset' => 'custom', 'from' => $from, 'to' => $to];
    }

    private static function isoDate(mixed $value, bool $endOfDay = false): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            $date = CarbonImmutable::parse($value);
        } catch (\Throwable) {
            return null;
        }

        return ($endOfDay ? $date->endOfDay() : $date->startOfDay())->toIso8601String();
    }

    /**
     * @return list<string>
     */
    private static function stringList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(
            array_map(static fn ($v) => is_string($v) ? $v : null, $value),
            static fn ($v) => $v !== null && $v !== '',
        ));
    }

    private static function scalar(mixed $value): string|int|float|null
    {
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_int($value) || is_float($value)) {
            return $value;
        }
        if (is_string($value)) {
            return mb_substr(trim($value), 0, 190);
        }

        return null;
    }
}

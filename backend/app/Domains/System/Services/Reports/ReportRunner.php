<?php

namespace App\Domains\System\Services\Reports;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * ---------------------------------------------------------------------------
 * Report runner — validated ids in, read-only rows out
 * ---------------------------------------------------------------------------
 *
 * Execution pipeline (nothing may skip a step):
 *
 *     Report Query Object  →  ReportQueryValidator  →  ReportRunner
 *                                     ↓                     ↓
 *                            catalog allowlist       static SQL fragments
 *                            + permissions           + bound parameters
 *                                                          ↓
 *                                                  one read-only SELECT
 *
 * Row-level scoping: a user without `reports.view_all_branches` only ever sees
 * their own department's rows, added here as a bound predicate rather than
 * trusted from the request.
 *
 * `assertReadOnly()` is the last line of defence — it inspects the assembled
 * statement and refuses anything that is not a single SELECT.
 */
class ReportRunner
{
    /**
     * Run a validated query.
     *
     * @param  array<string, mixed>  $query
     * @param  callable(string): bool  $can
     * @return array<string, mixed>
     */
    public static function run(array $query, callable $can, ?User $user = null): array
    {
        $started = microtime(true);
        $ds = ReportCatalog::dataset($query['module']);
        $scope = self::scopeFor($ds, $can, $user);

        [$sql, $bindings, $columns] = self::buildSql($query, $ds, $scope);
        self::assertReadOnly($sql);

        $rows = [];
        foreach (DB::select($sql, $bindings) as $record) {
            $row = [];
            foreach ($columns as $column) {
                $row[$column['key']] = ((array) $record)[$column['key']] ?? null;
            }
            $rows[] = $row;
        }

        $summary = [];
        $totalRows = count($rows);

        if ($query['mode'] === 'aggregate' && $query['metrics']) {
            [$totalSql, $totalBindings, $metricIds] = self::buildSummarySql($query, $ds, $scope);
            self::assertReadOnly($totalSql);
            $totals = (array) (DB::selectOne($totalSql, $totalBindings) ?? []);
            $totalRows = (int) ($totals['row_total'] ?? 0);

            foreach ($metricIds as $index => $id) {
                $summary[] = [
                    'id' => $id,
                    'labelKey' => $ds['metrics'][$id]['labelKey'],
                    'type' => $ds['metrics'][$id]['format'] ?? 'number',
                    'value' => $totals['m'.$index] ?? 0,
                ];
            }
        }

        return [
            'query' => $query,
            'columns' => $columns,
            'rows' => $rows,
            'summary' => $summary,
            'meta' => [
                'module' => $query['module'],
                'moduleLabelKey' => $ds['labelKey'],
                'mode' => $query['mode'],
                'generated_at' => now()->toIso8601String(),
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'row_count' => count($rows),
                'total_rows' => $totalRows,
                'truncated' => count($rows) >= $query['limit'],
                'scoped' => (bool) $scope,
                'scope' => $scope['label'] ?? null,
                'date_range' => $query['dateRange'] ?? $query['filters']['date_range'] ?? null,
                'chart' => $query['chart'],
            ],
        ];
    }

    /**
     * Department scoping for callers who may not see the whole university.
     *
     * @param  array<string, mixed>  $ds
     * @param  callable(string): bool  $can
     * @return array{clause: string, bindings: list<mixed>, label: string}|null
     */
    public static function scopeFor(array $ds, callable $can, ?User $user = null): ?array
    {
        if ($can('reports.view_all_branches')) {
            return null;
        }

        $column = $ds['scope']['department'] ?? null;
        $departmentId = $user?->department_id;

        if (! $column || ! $departmentId) {
            return null;
        }

        return [
            'clause' => $column.' = ?',
            'bindings' => [$departmentId],
            'label' => 'department',
        ];
    }

    /**
     * Assemble the SELECT.
     *
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $ds
     * @param  array<string, mixed>|null  $scope
     * @return array{0: string, 1: list<mixed>, 2: list<array<string, mixed>>}
     */
    public static function buildSql(array $query, array $ds, ?array $scope): array
    {
        $dateExpr = $ds['dates'][$query['dateField']]['expr'] ?? null;
        $select = [];
        $columns = [];
        $usedDefs = [];
        $groupBy = [];

        if ($query['mode'] === 'aggregate') {
            foreach ($query['dimensions'] as $index => $id) {
                $isTime = in_array($id, ReportCatalog::TIME_DIMENSIONS, true);
                $def = $isTime
                    ? ['needs' => $ds['dates'][$query['dateField']]['needs'] ?? []]
                    : $ds['dimensions'][$id];
                $expr = $isTime ? ReportCatalog::timeBucketSql($id, (string) $dateExpr) : $def['expr'];

                $usedDefs[] = $def;
                $select[] = $expr.' AS d'.$index;
                $groupBy[] = (string) ($index + 1);
                $columns[] = [
                    'key' => 'd'.$index,
                    'id' => $id,
                    'role' => 'dimension',
                    'labelKey' => $isTime ? ReportCatalog::timeBucketLabelKey($id) : $def['labelKey'],
                    'type' => $isTime ? 'time' : 'text',
                    'translate' => $def['translate'] ?? null,
                ];
            }

            foreach ($query['metrics'] as $index => $id) {
                $def = $ds['metrics'][$id];
                $usedDefs[] = $def;
                $select[] = $def['expr'].' AS m'.$index;
                $columns[] = [
                    'key' => 'm'.$index,
                    'id' => $id,
                    'role' => 'metric',
                    'labelKey' => $def['labelKey'],
                    'type' => $def['format'] ?? 'number',
                ];
            }
        } else {
            foreach ($query['fields'] as $index => $id) {
                $def = $ds['fields'][$id];
                $usedDefs[] = $def;
                $select[] = $def['expr'].' AS f'.$index;
                $columns[] = [
                    'key' => 'f'.$index,
                    'id' => $id,
                    'role' => 'field',
                    'labelKey' => $def['labelKey'],
                    'type' => $def['format'] ?? 'text',
                    'translate' => $def['translate'] ?? null,
                ];
            }
        }

        [$clauses, $bindings, $needs] = self::whereFor($query, $ds, $scope);
        $joins = self::joinsFor($ds, array_merge($usedDefs, $needs));

        $sql = 'SELECT '.implode(', ', $select)
            .' FROM '.$ds['from']
            .($joins ? ' '.implode(' ', $joins) : '')
            .($clauses ? ' WHERE '.implode(' AND ', $clauses) : '')
            .($groupBy ? ' GROUP BY '.implode(', ', $groupBy) : '');

        // Sorting always references an aliased output column, never raw input.
        $sortColumn = null;
        foreach ($columns as $column) {
            if ($column['id'] === ($query['sort']['field'] ?? null)) {
                $sortColumn = $column;
                break;
            }
        }
        if ($sortColumn) {
            $sql .= ' ORDER BY '.$sortColumn['key'].' '.(($query['sort']['direction'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC');
        }

        $sql .= ' LIMIT '.(int) $query['limit'];

        return [$sql, $bindings, $columns];
    }

    /**
     * Totals for the summary cards: same filters, no grouping.
     *
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $ds
     * @param  array<string, mixed>|null  $scope
     * @return array{0: string, 1: list<mixed>, 2: list<string>}
     */
    public static function buildSummarySql(array $query, array $ds, ?array $scope): array
    {
        $select = ['COUNT(*) AS row_total'];
        $usedDefs = [];

        foreach ($query['metrics'] as $index => $id) {
            $def = $ds['metrics'][$id];
            $usedDefs[] = $def;
            $select[] = $def['expr'].' AS m'.$index;
        }

        [$clauses, $bindings, $needs] = self::whereFor($query, $ds, $scope);
        $joins = self::joinsFor($ds, array_merge($usedDefs, $needs));

        $sql = 'SELECT '.implode(', ', $select)
            .' FROM '.$ds['from']
            .($joins ? ' '.implode(' ', $joins) : '')
            .($clauses ? ' WHERE '.implode(' AND ', $clauses) : '');

        return [$sql, $bindings, $query['metrics']];
    }

    /**
     * WHERE clauses for the base filter, the period, the user filters and the
     * permission scope — every value bound, never interpolated.
     *
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $ds
     * @param  array<string, mixed>|null  $scope
     * @return array{0: list<string>, 1: list<mixed>, 2: list<array<string, mixed>>}
     */
    private static function whereFor(array $query, array $ds, ?array $scope): array
    {
        $clauses = $ds['baseWhere'] ?? [];
        $bindings = [];
        $needs = [];

        $range = $query['dateRange'] ?? $query['filters']['date_range'] ?? null;
        $dateExpr = $ds['dates'][$query['dateField']]['expr'] ?? null;

        if ($dateExpr && $range && ($range['from'] ?? null)) {
            $clauses[] = $dateExpr.' >= ?';
            $bindings[] = $range['from'];
        }
        if ($dateExpr && $range && ($range['to'] ?? null)) {
            $clauses[] = $dateExpr.' <= ?';
            $bindings[] = $range['to'];
        }
        if ($dateExpr && $range && (($range['from'] ?? null) || ($range['to'] ?? null))) {
            $needs[] = ['needs' => $ds['dates'][$query['dateField']]['needs'] ?? []];
        }

        foreach ($query['filters'] as $id => $spec) {
            if ($id === 'date_range') {
                continue;
            }

            $def = $ds['filters'][$id];
            $needs[] = $def;
            $expr = $def['expr'];
            $op = $spec['op'];
            $value = $spec['value'] ?? null;

            switch ($op) {
                case 'eq':
                    $clauses[] = $expr.' = ?';
                    $bindings[] = $value;
                    break;
                case 'neq':
                    $clauses[] = '('.$expr.' IS NULL OR '.$expr.' <> ?)';
                    $bindings[] = $value;
                    break;
                case 'gt':
                case 'gte':
                case 'lt':
                case 'lte':
                    $clauses[] = $expr.' '.['gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<='][$op].' ?';
                    $bindings[] = $value;
                    break;
                case 'between':
                    $clauses[] = $expr.' BETWEEN ? AND ?';
                    $bindings[] = $value[0];
                    $bindings[] = $value[1];
                    break;
                case 'contains':
                    $clauses[] = $expr." LIKE ? ESCAPE '\\'";
                    $bindings[] = '%'.self::escapeLike((string) $value).'%';
                    break;
                case 'not_contains':
                    $clauses[] = '('.$expr.' IS NULL OR '.$expr." NOT LIKE ? ESCAPE '\\')";
                    $bindings[] = '%'.self::escapeLike((string) $value).'%';
                    break;
                case 'starts_with':
                    $clauses[] = $expr." LIKE ? ESCAPE '\\'";
                    $bindings[] = self::escapeLike((string) $value).'%';
                    break;
                case 'in':
                    $clauses[] = $expr.' IN ('.implode(', ', array_fill(0, count($value), '?')).')';
                    foreach ($value as $entry) {
                        $bindings[] = $entry;
                    }
                    break;
                case 'is_empty':
                    $clauses[] = '('.$expr.' IS NULL OR '.$expr." = '')";
                    break;
                case 'is_not_empty':
                    $clauses[] = '('.$expr.' IS NOT NULL AND '.$expr." <> '')";
                    break;
            }
        }

        if ($scope) {
            $clauses[] = $scope['clause'];
            foreach ($scope['bindings'] as $binding) {
                $bindings[] = $binding;
            }
        }

        return [array_values($clauses), $bindings, $needs];
    }

    /**
     * @param  array<string, mixed>  $ds
     * @param  list<array<string, mixed>>  $defs
     * @return list<string>
     */
    private static function joinsFor(array $ds, array $defs): array
    {
        $wanted = [];
        foreach ($defs as $def) {
            foreach ($def['needs'] ?? [] as $need) {
                $wanted[$need] = true;
            }
        }

        $joins = [];
        foreach ($ds['joins'] ?? [] as $key => $clause) {
            if (isset($wanted[$key])) {
                $joins[] = $clause;
            }
        }

        return $joins;
    }

    private static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }

    /**
     * Final safety net: a report may only ever be a single SELECT.
     *
     * @throws ReportQueryException
     */
    public static function assertReadOnly(string $sql): void
    {
        $normalised = trim(preg_replace('/\s+/', ' ', $sql) ?? '');

        if (! preg_match('/^SELECT\s/i', $normalised)) {
            throw new ReportQueryException('Only read-only report queries are allowed.', [], 400);
        }

        // No stacked statements: a semicolon may only close the statement.
        if (preg_match('/;\s*\S/', $normalised)) {
            throw new ReportQueryException('Only a single statement may be executed.', [], 400);
        }

        if (preg_match('/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|GRANT|REVOKE)\b/i', $normalised)) {
            throw new ReportQueryException('Only read-only report queries are allowed.', [], 400);
        }
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Financial\Models\AssetDepreciation;
use App\Domains\Maintenance\Models\AssetMaintenance;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

/**
 * Module 23 — Reports & export.
 *
 * All reports support CSV (streaming, dependency-free). Excel and PDF
 * exports are available through maatwebsite/excel and barryvdh/laravel-dompdf
 * respectively — their generation is delegated to ReportExportService so the
 * controller stays thin.
 */
class ReportController extends Controller
{
    public function index(): JsonResponse
    {
        return ApiResponse::success('Available reports retrieved successfully.', [
            'asset_register' => 'All assets with full detail',
            'assets_by_category' => 'Assets grouped by category',
            'assets_by_location' => 'Assets grouped by campus/building',
            'assigned_assets' => 'Currently assigned assets',
            'available_assets' => 'Available (unassigned) assets',
            'maintenance_history' => 'Maintenance records with costs',
            'maintenance_cost' => 'Maintenance cost summary',
            'asset_value' => 'Purchase / current / depreciated value summary',
            'depreciation_schedule' => 'Monthly depreciation records',
            'disposal_report' => 'Disposed assets by method',
            'audit_missing' => 'Assets flagged missing in audits',
            'audit_damaged' => 'Assets flagged damaged in audits',
        ]);
    }

    public function export(Request $request, string $report): Response|JsonResponse
    {
        $format = $request->query('format', 'csv');

        if (! in_array($format, ['csv', 'xlsx', 'pdf'], true)) {
            return ApiResponse::error('Unsupported export format. Use csv, xlsx or pdf.', 422);
        }

        $rows = $this->rows($report, $request);

        if ($rows instanceof JsonResponse) {
            return $rows;
        }

        $filename = $report.'-'.now()->format('Ymd-His');

        if ($format === 'xlsx') {
            return \App\Domains\System\Services\ReportExportService::excel($report, $rows, $filename);
        }

        if ($format === 'pdf') {
            return \App\Domains\System\Services\ReportExportService::pdf($report, $rows, $filename);
        }

        return $this->csv($report, $rows, $filename);
    }

    /**
     * @return array<int, array<string, mixed>>|JsonResponse
     */
    protected function rows(string $report, Request $request): array|JsonResponse
    {
        return match ($report) {
            'asset_register' => Asset::with('category', 'department', 'building', 'room', 'supplier')
                ->get()
                ->map(fn ($a) => [
                    'code' => $a->asset_code,
                    'name' => $a->name,
                    'category' => $a->category?->name,
                    'brand' => $a->brand,
                    'model' => $a->model,
                    'serial' => $a->serial_number,
                    'status' => $a->status,
                    'condition' => $a->condition,
                    'location' => collect([$a->room?->name, $a->building?->name, $a->department?->name])->filter()->implode(' / '),
                    'purchase_date' => $a->purchase_date?->toDateString(),
                    'purchase_price' => $a->purchase_price,
                    'current_value' => $a->current_value,
                ])
                ->all(),

            'assets_by_category' => Asset::query()
                ->selectRaw('category_id, COUNT(*) as total, SUM(purchase_price) as value')
                ->with('category')
                ->groupBy('category_id')
                ->get()
                ->map(fn ($row) => [
                    'category' => $row->category?->name ?? 'Uncategorized',
                    'total_assets' => $row->total,
                    'total_value' => round((float) $row->value, 2),
                ])
                ->all(),

            'assets_by_location' => Asset::with('campus', 'building', 'room')
                ->get()
                ->map(fn ($a) => [
                    'code' => $a->asset_code,
                    'name' => $a->name,
                    'campus' => $a->campus?->name,
                    'building' => $a->building?->name,
                    'room' => $a->room?->name,
                    'status' => $a->status,
                ])
                ->all(),

            'assigned_assets' => Asset::where('status', Asset::STATUS_ASSIGNED)
                ->with('activeAssignment.assignee')
                ->get()
                ->map(fn ($a) => [
                    'code' => $a->asset_code,
                    'name' => $a->name,
                    'assigned_to' => $a->activeAssignment?->assignee?->name,
                    'assigned_date' => $a->activeAssignment?->assigned_date?->toDateString(),
                    'expected_return' => $a->activeAssignment?->expected_return_date?->toDateString(),
                ])
                ->all(),

            'available_assets' => Asset::where('status', Asset::STATUS_AVAILABLE)
                ->get()
                ->map(fn ($a) => [
                    'code' => $a->asset_code,
                    'name' => $a->name,
                    'category' => $a->category?->name,
                    'current_value' => $a->current_value,
                ])
                ->all(),

            'maintenance_history' => AssetMaintenance::with('asset', 'technician')
                ->get()
                ->map(fn ($m) => [
                    'asset' => $m->asset?->name,
                    'type' => $m->maintenance_type,
                    'status' => $m->status,
                    'technician' => $m->technician?->name,
                    'start' => $m->start_date?->toDateString(),
                    'end' => $m->end_date?->toDateString(),
                    'cost' => $m->cost,
                ])
                ->all(),

            'maintenance_cost' => AssetMaintenance::query()
                ->selectRaw('maintenance_type, COUNT(*) as count, SUM(cost) as total_cost')
                ->where('status', 'completed')
                ->groupBy('maintenance_type')
                ->get()
                ->map(fn ($row) => [
                    'type' => $row->maintenance_type,
                    'work_orders' => $row->count,
                    'total_cost' => round((float) $row->total_cost, 2),
                ])
                ->all(),

            'asset_value' => [
                [
                    'total_purchase_value' => round((float) Asset::sum('purchase_price'), 2),
                    'current_value' => round((float) Asset::sum('current_value'), 2),
                    'depreciated_value' => round((float) (Asset::sum('purchase_price') - Asset::sum('current_value')), 2),
                ],
            ],

            'depreciation_schedule' => AssetDepreciation::with('asset', 'method')
                ->when($request->query('period'), fn ($q, $p) => $q->where('period', $p))
                ->latest('period')
                ->limit(2000)
                ->get()
                ->map(fn ($d) => [
                    'period' => $d->period,
                    'asset' => $d->asset?->name,
                    'method' => $d->method?->name,
                    'original_value' => $d->original_value,
                    'annual_depreciation' => $d->annual_depreciation,
                    'accumulated' => $d->accumulated_depreciation,
                    'book_value' => $d->book_value,
                ])
                ->all(),

            'disposal_report' => \App\Domains\Financial\Models\AssetDisposal::with('asset')
                ->get()
                ->map(fn ($d) => [
                    'asset' => $d->asset?->name,
                    'method' => $d->method,
                    'status' => $d->status,
                    'requested' => $d->request_date?->toDateString(),
                    'disposed' => $d->disposal_date?->toDateString(),
                    'revenue' => $d->revenue,
                ])
                ->all(),

            'audit_missing' => \App\Domains\Audit\Models\AssetAuditItem::where('verification', 'missing')
                ->with('asset', 'audit')
                ->get()
                ->map(fn ($item) => [
                    'audit' => $item->audit?->audit_code,
                    'asset' => $item->asset?->name,
                    'asset_code' => $item->asset?->asset_code,
                ])
                ->all(),

            'audit_damaged' => \App\Domains\Audit\Models\AssetAuditItem::where('verification', 'damaged')
                ->with('asset', 'audit')
                ->get()
                ->map(fn ($item) => [
                    'audit' => $item->audit?->audit_code,
                    'asset' => $item->asset?->name,
                    'asset_code' => $item->asset?->asset_code,
                    'notes' => $item->notes,
                ])
                ->all(),

            default => ApiResponse::error('Unknown report: '.$report, 404),
        };
    }

    /**
     * Stream a CSV response (BOM included for Excel compatibility).
     *
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected function csv(string $report, array $rows, string $filename): Response
    {
        $headers = count($rows) ? array_keys($rows[0]) : ['no data'];
        $filename = Str::slug($filename).'.csv';

        $callback = function () use ($rows, $headers) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF"); // UTF-8 BOM
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, array_values($row));
            }
            fclose($handle);
        };

        return response()->streamDownload($callback, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}

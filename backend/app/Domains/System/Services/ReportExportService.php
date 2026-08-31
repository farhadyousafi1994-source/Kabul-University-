<?php

namespace App\Domains\System\Services;

use Illuminate\Http\Response;
use Illuminate\Support\Str;

/**
 * Excel/PDF export adapter.
 *
 * CSV is implemented directly in ReportController (dependency-free). For
 * xlsx/pdf we use Maatwebsite\Excel and Barryvdh\DomPDF when installed; if
 * composer dependencies are not available (e.g. minimal dev environment) we
 * degrade gracefully to CSV so reports always work.
 */
class ReportExportService
{
    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public static function excel(string $report, array $rows, string $filename): Response
    {
        if (! class_exists(\Maatwebsite\Excel\Facades\Excel::class)) {
            return self::degradeToCsv($report, $rows, $filename);
        }

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\GenericArrayExport($rows),
            Str::slug($filename).'.xlsx',
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public static function pdf(string $report, array $rows, string $filename): Response
    {
        if (! class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            return self::degradeToCsv($report, $rows, $filename);
        }

        $html = view('exports.table', [
            'title' => Str::headline(str_replace('_', ' ', $report)),
            'headers' => count($rows) ? array_keys($rows[0]) : [],
            'rows' => $rows,
        ])->render();

        return \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)
            ->setPaper('a4', 'landscape')
            ->download(Str::slug($filename).'.pdf');
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected static function degradeToCsv(string $report, array $rows, string $filename): Response
    {
        $headers = count($rows) ? array_keys($rows[0]) : ['no data'];

        $callback = function () use ($rows, $headers) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, array_values($row));
            }
            fclose($handle);
        };

        return response()->streamDownload($callback, Str::slug($filename).'.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }
}

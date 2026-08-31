<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class GenericArrayExport implements FromArray, WithHeadings, ShouldAutoSize
{
    public function __construct(protected array $rows)
    {
    }

    public function array(): array
    {
        return array_values($this->rows);
    }

    public function headings(): array
    {
        return count($this->rows) ? array_keys($this->rows[0]) : ['no data'];
    }
}

<?php

namespace App\Domains\System\Services\Reports;

use Exception;

/**
 * A report request that the catalog refuses.
 *
 * Carries a field => messages map so the API can answer with the same 422
 * envelope every other endpoint uses, and the report builder can highlight the
 * offending control.
 */
class ReportQueryException extends Exception
{
    /**
     * @param  array<string, list<string>>  $errors
     */
    public function __construct(
        string $message = 'Invalid report request.',
        public readonly array $errors = [],
        public readonly int $status = 422,
    ) {
        parent::__construct($message);
    }
}

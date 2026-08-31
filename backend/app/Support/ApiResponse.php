<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * Standard KU-AMS API envelope.
 *
 *   success: {"success":true,  "message":"…", "data":{…}}
 *   error:   {"success":false, "message":"…", "errors":{…}} (422)
 */
class ApiResponse
{
    public static function success(string $message, mixed $data = null, ?array $meta = null, int $status = 200): JsonResponse
    {
        $payload = ['success' => true, 'message' => $message];

        if ($data !== null) {
            $payload['data'] = $data;
        } else {
            $payload['data'] = (object) [];
        }

        if ($meta !== null) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    public static function error(string $message, int $status = 400, ?array $errors = null): JsonResponse
    {
        $payload = ['success' => false, 'message' => $message];

        if ($errors !== null) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    /**
     * Pagination meta extracted from a LengthAwarePaginator.
     */
    public static function paginationMeta(\Illuminate\Contracts\Pagination\LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ];
    }
}

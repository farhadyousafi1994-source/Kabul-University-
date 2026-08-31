<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects requests from users whose account has been deactivated.
 * Deactivated users keep their tokens invalidated at deactivation time
 * (see UserService::deactivate) and this middleware adds a second layer
 * of defence for requests made with tokens issued before deactivation.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Your account is deactivated. Please contact the administrator.',
            ], 403);
        }

        return $next($request);
    }
}

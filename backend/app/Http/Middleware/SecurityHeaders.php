<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SecurityHeaders — adds the standard hardening response headers to every
 * API response (and web responses when applied globally).
 *
 *   X-Content-Type-Options  : nosniff
 *   X-Frame-Options         : DENY          (API has no UI; SPA is separate)
 *   Referrer-Policy         : strict-origin-when-cross-origin
 *   Permissions-Policy      : camera=(), microphone=(), geolocation=()
 *   X-XSS-Protection        : 0             (modern browsers; avoids legacy misfires)
 *   Cache-Control           : no-store      (API responses are not cacheable)
 *
 * HSTS is intentionally NOT set here — it must be enabled at the TLS
 * termination point (nginx/load balancer) with the correct max-age once the
 * domain is final, to avoid HSTS-on-HTTP lockout during staging.
 */
class SecurityHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set('X-XSS-Protection', '0');
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}

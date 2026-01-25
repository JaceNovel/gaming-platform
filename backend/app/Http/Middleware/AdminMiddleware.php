<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return $this->deny($request, Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->isAdmin()) {
            return $this->deny($request, Response::HTTP_FORBIDDEN);
        }

        if ($this->ipIsBlocked($request)) {
            return $this->deny($request, Response::HTTP_FORBIDDEN, 'IP not allowed');
        }

        return $next($request);
    }

    private function ipIsBlocked(Request $request): bool
    {
        $allowedIps = config('admin.allowed_ips', []);

        if (empty($allowedIps)) {
            return false;
        }

        return !in_array($request->ip(), $allowedIps, true);
    }

    private function deny(Request $request, int $status, string $message = 'Unauthorized'): Response
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json(['message' => $message], $status);
        }

        return redirect()->guest(route('login'));
    }
}

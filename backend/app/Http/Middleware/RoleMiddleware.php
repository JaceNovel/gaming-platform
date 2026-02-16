<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        if (empty($roles)) {
            return response()->json(['message' => 'Unauthorized'], Response::HTTP_FORBIDDEN);
        }

        $normalizedAllowedRoles = array_values(array_filter(array_map(
            static fn ($role) => strtolower(trim((string) $role)),
            $roles
        )));
        $normalizedUserRole = strtolower(trim((string) $user->role));

        if (!in_array($normalizedUserRole, $normalizedAllowedRoles, true)) {
            $payload = ['message' => 'Unauthorized'];

            if (config('admin.log_role_denies', false)) {
                Log::warning('Role denied', [
                    'user_id' => $user->id ?? null,
                    'current_role' => (string) $user->role,
                    'allowed_roles' => $roles,
                    'path' => $request->path(),
                    'method' => $request->method(),
                    'request_id' => $request->headers->get('X-Request-ID')
                        ?? $request->headers->get('X-Request-Id')
                        ?? $request->headers->get('X-Correlation-ID')
                        ?? null,
                ]);
            }

            if (config('app.debug')) {
                $payload['meta'] = [
                    'current_role' => (string) $user->role,
                    'allowed_roles' => $roles,
                    'path' => $request->path(),
                ];
            }

            return response()->json($payload, Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}

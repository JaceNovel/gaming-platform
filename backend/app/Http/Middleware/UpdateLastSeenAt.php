<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class UpdateLastSeenAt
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        try {
            $user = $request->user();
            if (!$user) {
                return $response;
            }

            $now = now();
            $lastSeen = $user->last_seen_at;

            // Avoid writing on every request.
            if (!$lastSeen || $lastSeen->lt($now->copy()->subMinutes(30))) {
                $user->forceFill(['last_seen_at' => $now])->save();
            }
        } catch (\Throwable) {
            // best-effort
        }

        return $response;
    }
}

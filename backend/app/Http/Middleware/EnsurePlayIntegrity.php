<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlayIntegrity
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        $platform = strtolower((string) $request->header('X-Client-Platform', ''));
        if ($platform !== 'android') {
            return $next($request);
        }

        $cacheKey = 'play_integrity:user:' . $user->id;
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && ($cached['allowed'] ?? false) === true) {
            return $next($request);
        }

        $supportUrl = (string) env('SUPPORT_URL', '');

        return response()->json([
            'message' => 'Verification de securite requise. Contacte le support pour debloquer cette action.',
            'code' => 'INTEGRITY_BLOCK',
            'support_url' => $supportUrl !== '' ? $supportUrl : null,
        ], 423);
    }
}

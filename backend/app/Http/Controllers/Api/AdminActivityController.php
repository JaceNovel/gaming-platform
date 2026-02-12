<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AdminActivityService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AdminActivityController extends Controller
{
    public function recent(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'UNAUTHENTICATED'], 401);
        }

        $sinceRaw = $request->query('since');
        $limit = max(1, min(30, (int) $request->query('limit', 12)));

        $since = null;
        if (is_string($sinceRaw) && trim($sinceRaw) !== '') {
            try {
                $since = Carbon::parse($sinceRaw);
            } catch (\Throwable $e) {
                $since = null;
            }
        }

        // Default window: last 24h if no cursor is provided.
        if (!$since) {
            $since = Carbon::now()->subDay();
        }

        $service = app(AdminActivityService::class);
        $result = $service->recentForUser($user, $since, $limit);
        $counts = $result['counts'] ?? [];
        $events = $result['items'] ?? [];

        return response()->json([
            'now' => Carbon::now()->toIso8601String(),
            'since' => $since->toIso8601String(),
            'counts' => $counts,
            'items' => $events,
        ]);
    }
}

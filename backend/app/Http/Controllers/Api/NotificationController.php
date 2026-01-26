<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $limit = min(50, max(1, (int) $request->query('limit', 10)));
        $type = $request->query('type');

        $itemsQuery = $user->notifications();
        if ($type) {
            $itemsQuery->where('type', $type);
        }

        $items = $itemsQuery
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $unreadQuery = $user->notifications()->where('is_read', false);
        if ($type) {
            $unreadQuery->where('type', $type);
        }
        $unreadCount = $unreadQuery->count();

        return response()->json([
            'unread' => $unreadCount,
            'notifications' => $items,
        ]);
    }

    public function markAllRead(Request $request)
    {
        $user = $request->user();
        $type = $request->query('type');

        $query = $user->notifications()->where('is_read', false);
        if ($type) {
            $query->where('type', $type);
        }
        $query->update(['is_read' => true]);

        return response()->json(['status' => 'ok']);
    }

    public function markRead(Notification $notification, Request $request)
    {
        $user = $request->user();

        if ($notification->user_id !== $user->id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $notification->update(['is_read' => true]);

        return response()->json(['status' => 'ok']);
    }
}

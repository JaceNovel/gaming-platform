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

        $items = $user->notifications()
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $unreadCount = $user->notifications()->where('is_read', false)->count();

        return response()->json([
            'unread' => $unreadCount,
            'notifications' => $items,
        ]);
    }

    public function markAllRead(Request $request)
    {
        $user = $request->user();

        $user->notifications()
            ->where('is_read', false)
            ->update(['is_read' => true]);

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

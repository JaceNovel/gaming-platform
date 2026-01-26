<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AdminAuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class AdminNotificationController extends Controller
{
    public function broadcast(Request $request, NotificationService $notificationService, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'message' => 'required|string|max:500',
        ]);

        $notificationService->broadcast('update', $data['message']);

        $auditLogger->log(
            $request->user(),
            'notification_broadcast',
            [
                'message' => 'Broadcasted site update',
            ],
            actionType: 'notifications',
            request: $request
        );

        return response()->json(['status' => 'ok']);
    }
}

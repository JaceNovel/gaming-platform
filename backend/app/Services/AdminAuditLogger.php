<?php

namespace App\Services;

use App\Models\AdminLog;
use App\Models\User;
use Illuminate\Http\Request;

class AdminAuditLogger
{
    public function log(User $admin, string $action, array $details = [], ?string $actionType = null, ?Request $request = null): AdminLog
    {
        return AdminLog::create([
            'admin_id' => $admin->id,
            'action' => $action,
            'action_type' => $actionType,
            'details' => $details['message'] ?? null,
            'metadata' => $details,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'performed_at' => now(),
        ]);
    }
}

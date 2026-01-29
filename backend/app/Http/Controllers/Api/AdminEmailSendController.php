<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailJob;
use App\Mail\AdminDirectMessage;
use App\Models\EmailLog;
use App\Models\User;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;

class AdminEmailSendController extends Controller
{
    public function sendDirect(Request $request, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'to_email' => 'required|email|max:255',
            'subject' => 'nullable|string|max:255',
            'message' => 'required|string|max:5000',
        ]);

        $to = strtolower(trim($data['to_email']));
        $subject = trim((string) ($data['subject'] ?? 'Message de BADBOYSHOP'));
        $message = (string) $data['message'];

        $targetUser = User::where('email', $to)->first();

        $emailLog = EmailLog::create([
            'user_id' => $targetUser?->id,
            'to' => $to,
            'type' => 'admin_direct',
            'subject' => $subject,
            'status' => 'queued',
        ]);

        $adminName = $request->user()?->name;
        $mailable = new AdminDirectMessage($subject, $message, $adminName);

        dispatch(new SendEmailJob($mailable, $emailLog));

        $auditLogger->log(
            $request->user(),
            'admin_email_direct',
            [
                'message' => 'Sent direct email',
                'to' => $to,
                'subject' => $subject,
                'email_log_id' => $emailLog->id,
                'user_id' => $targetUser?->id,
            ],
            actionType: 'email',
            request: $request
        );

        return response()->json([
            'data' => [
                'email_log' => $emailLog,
            ],
        ]);
    }
}

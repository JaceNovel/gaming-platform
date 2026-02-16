<?php

namespace App\Services;

use App\Jobs\SendEmailJob;
use App\Models\EmailLog;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;

class LoggedEmailService
{
    public function queue(
        ?int $userId,
        string $to,
        string $type,
        string $subject,
        Mailable $mailable,
        array $meta = []
    ): ?EmailLog {
        $to = strtolower(trim($to));
        if ($to === '') {
            return null;
        }

        try {
            $emailLog = EmailLog::create([
                'user_id' => $userId,
                'to' => $to,
                'type' => $type,
                'subject' => $subject,
                // Keep DB-compat: status is an enum (pending|sent|failed)
                'status' => 'pending',
                // Column is non-nullable in current migration; updated again on success.
                'sent_at' => now(),
            ]);

            dispatch(new SendEmailJob($mailable, $emailLog));

            return $emailLog;
        } catch (\Throwable $e) {
            Log::warning('email.queue_failed', [
                'to' => $to,
                'type' => $type,
                'subject' => $subject,
                'error' => $e->getMessage(),
                'meta' => $meta,
            ]);

            return null;
        }
    }
}

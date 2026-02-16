<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password as PasswordFacade;

class SendPasswordResetLink implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public string $email)
    {
    }

    public function handle(): void
    {
        $email = strtolower(trim($this->email));
        if ($email === '') {
            return;
        }

        try {
            PasswordFacade::sendResetLink(['email' => $email]);
        } catch (\Throwable $e) {
            // Never rethrow: reset link delivery is best-effort and should not poison the queue.
            Log::warning('forgot_password.send_reset_link_failed', [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);
        }
    }
}

<?php

namespace App\Jobs;

use App\Models\EmailLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

class SendEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [60, 300, 600]; // 1min, 5min, 10min

    protected $mailable;
    protected $emailLog;

    public function __construct($mailable, EmailLog $emailLog)
    {
        $this->mailable = $mailable;
        $this->emailLog = $emailLog;
    }

    public function handle()
    {
        try {
            // Ensure the recipient is applied from the EmailLog.
            // Many Mailables in this codebase are constructed without calling ->to().
            Mail::to((string) ($this->emailLog->to ?? ''))
                ->send($this->mailable);

            $this->emailLog->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);
        } catch (Throwable $e) {
            $this->emailLog->update([
                'status' => 'failed',
                'error' => $e->getMessage(),
            ]);

            // If credentials are wrong (SMTP 535), retries will never help and can
            // cause noisy logs / queue backlogs. Mark failed and stop retrying.
            if ($e instanceof TransportExceptionInterface) {
                $msg = $e->getMessage();
                if (str_contains($msg, '535') || str_contains($msg, 'HTTP 401') || str_contains($msg, 'HTTP 403')) {
                    return;
                }
                throw $e;
            }

            throw $e; // Re-throw to trigger retry for transient errors
        }
    }

    public function failed(Throwable $exception)
    {
        $this->emailLog->update([
            'status' => 'failed',
            'error' => $exception->getMessage(),
        ]);
    }
}
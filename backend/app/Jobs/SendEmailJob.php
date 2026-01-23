<?php

namespace App\Jobs;

use App\Models\EmailLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
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
            Mail::send($this->mailable);

            $this->emailLog->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);
        } catch (Throwable $e) {
            $this->emailLog->update([
                'status' => 'failed',
                'error' => $e->getMessage(),
            ]);

            throw $e; // Re-throw to trigger retry
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
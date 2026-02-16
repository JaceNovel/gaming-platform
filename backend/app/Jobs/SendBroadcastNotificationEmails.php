<?php

namespace App\Jobs;

use App\Mail\TemplatedNotification;
use App\Models\User;
use App\Services\LoggedEmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendBroadcastNotificationEmails implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $message,
        public ?string $adminName = null,
    ) {
    }

    public function handle(LoggedEmailService $loggedEmailService): void
    {
        $message = trim($this->message);
        if ($message === '') {
            return;
        }

        $front = rtrim((string) config('app.frontend_url'), '/');
        $subject = 'Mise à jour - PRIME Gaming';

        User::query()
            ->select(['id', 'email', 'name'])
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->chunkById(500, function ($users) use ($loggedEmailService, $subject, $message, $front) {
                foreach ($users as $user) {
                    $to = strtolower(trim((string) $user->email));
                    if ($to === '') {
                        continue;
                    }

                    $mailable = new TemplatedNotification(
                        'admin_broadcast',
                        $subject,
                        [
                            'message' => $message,
                            'admin_name' => $this->adminName,
                            'user' => $user->toArray(),
                        ],
                        [
                            'title' => $subject,
                            'headline' => 'Mise à jour',
                            'intro' => $message,
                            'actionUrl' => $front . '/notifications',
                            'actionText' => 'Voir',
                        ]
                    );

                    $loggedEmailService->queue(
                        userId: (int) $user->id,
                        to: $to,
                        type: 'admin_broadcast',
                        subject: $subject,
                        mailable: $mailable,
                        meta: ['source' => 'admin_notifications']
                    );
                }
            });
    }
}

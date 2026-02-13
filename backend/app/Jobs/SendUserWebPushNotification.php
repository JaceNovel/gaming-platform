<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Services\WebPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendUserWebPushNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $notificationId,
    )
    {
    }

    public function handle(WebPushService $webPush): void
    {
        $notification = Notification::query()->with('user')->find($this->notificationId);
        if (!$notification) {
            return;
        }

        $user = $notification->user;
        if (!$user) {
            return;
        }

        $message = trim((string) ($notification->message ?? ''));
        if ($message === '') {
            return;
        }

        $webPush->sendToUser($user, [
            'title' => 'PRIME Gaming',
            'body' => $message,
            'url' => '/notifications',
        ]);
    }
}

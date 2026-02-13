<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\WebPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendUsersWebPushMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param  array<int,int>  $userIds
     */
    public function __construct(
        public array $userIds,
        public string $title,
        public string $body,
        public string $url = '/notifications',
    ) {
    }

    public function handle(WebPushService $webPush): void
    {
        $body = trim($this->body);
        if ($body === '' || empty($this->userIds)) {
            return;
        }

        $users = User::query()->whereIn('id', $this->userIds)->get(['id']);
        foreach ($users as $user) {
            $webPush->sendToUser($user, [
                'title' => $this->title,
                'body' => $body,
                'url' => $this->url,
            ]);
        }
    }
}

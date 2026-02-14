<?php

namespace App\Jobs;

use App\Models\DeviceToken;
use App\Services\FcmPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendUsersFcmPushMessage implements ShouldQueue
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

    public function handle(FcmPushService $fcm): void
    {
        $body = trim($this->body);
        if ($body === '' || empty($this->userIds)) {
            return;
        }

        $tokens = DeviceToken::query()
            ->whereIn('user_id', $this->userIds)
            ->pluck('token')
            ->map(fn ($t) => trim((string) $t))
            ->filter(fn ($t) => $t !== '')
            ->values()
            ->all();

        if (empty($tokens)) {
            return;
        }

        $fcm->sendToTokens($tokens, [
            'title' => $this->title,
            'body' => $body,
            'data' => [
                'url' => $this->url,
            ],
        ]);
    }
}

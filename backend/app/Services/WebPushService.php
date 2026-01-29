<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushService
{
    public function sendToUser(User $user, array $payload): void
    {
        $publicKey = (string) env('VAPID_PUBLIC_KEY', '');
        $privateKey = (string) env('VAPID_PRIVATE_KEY', '');
        $subject = (string) env('VAPID_SUBJECT', env('APP_URL', 'mailto:support@badboyshop.online'));

        if ($publicKey === '' || $privateKey === '') {
            return;
        }

        $subs = PushSubscription::where('user_id', $user->id)->get();
        if ($subs->isEmpty()) {
            return;
        }

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => $subject,
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ],
        ]);

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if (!is_string($json)) {
            return;
        }

        foreach ($subs as $sub) {
            try {
                $subscription = Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'publicKey' => $sub->public_key,
                    'authToken' => $sub->auth_token,
                    'contentEncoding' => $sub->content_encoding,
                ]);

                $report = $webPush->sendOneNotification($subscription, $json);
                $sub->forceFill(['last_used_at' => now()])->save();

                if (!$report->isSuccess()) {
                    $reason = (string) $report->getReason();
                    // If subscription is gone, cleanup.
                    if (str_contains(strtolower($reason), 'gone') || str_contains(strtolower($reason), 'not found')) {
                        $sub->delete();
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('WebPush send failed', [
                    'user_id' => $user->id,
                    'subscription_id' => $sub->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}

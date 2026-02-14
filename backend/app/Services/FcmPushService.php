<?php

namespace App\Services;

use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmPushService
{
    /**
     * @param array{title?:string,body?:string,url?:string,data?:array<string,mixed>} $payload
     */
    public function sendToUser(User $user, array $payload): void
    {
        $serverKey = trim((string) env('FCM_SERVER_KEY', ''));
        if ($serverKey === '') {
            return;
        }

        $tokens = DeviceToken::query()
            ->where('user_id', $user->id)
            ->pluck('token')
            ->map(fn ($t) => trim((string) $t))
            ->filter(fn ($t) => $t !== '')
            ->values()
            ->all();

        if (empty($tokens)) {
            return;
        }

        $title = trim((string) ($payload['title'] ?? ''));
        $body = trim((string) ($payload['body'] ?? ''));
        $url = trim((string) ($payload['url'] ?? ''));
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        if ($title === '') {
            $title = 'PRIME Gaming';
        }
        if ($body === '') {
            return;
        }
        if ($url !== '') {
            $data['url'] = $url;
        }

        $this->sendToTokens($tokens, [
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ]);
    }

    /**
     * @param array<int,string> $tokens
     * @param array{title:string,body:string,data:array<string,mixed>} $payload
     */
    public function sendToTokens(array $tokens, array $payload): void
    {
        $serverKey = trim((string) env('FCM_SERVER_KEY', ''));
        if ($serverKey === '') {
            return;
        }

        $tokens = array_values(array_filter(array_map('trim', $tokens)));
        if (empty($tokens)) {
            return;
        }

        $endpoint = 'https://fcm.googleapis.com/fcm/send';

        foreach (array_chunk($tokens, 500) as $chunk) {
            try {
                $body = [
                    'registration_ids' => $chunk,
                    'notification' => [
                        'title' => $payload['title'],
                        'body' => $payload['body'],
                    ],
                    'data' => $payload['data'],
                    'priority' => 'high',
                ];

                $res = Http::withHeaders([
                    'Authorization' => 'key=' . $serverKey,
                    'Content-Type' => 'application/json',
                ])
                    ->timeout(15)
                    ->post($endpoint, $body);

                if (!$res->ok()) {
                    Log::warning('FCM send failed', [
                        'status' => $res->status(),
                        'body' => $res->body(),
                    ]);
                    continue;
                }

                $json = $res->json();
                if (!is_array($json)) {
                    continue;
                }

                $results = $json['results'] ?? null;
                if (!is_array($results)) {
                    continue;
                }

                // Cleanup invalid tokens
                foreach ($results as $idx => $result) {
                    if (!is_array($result)) {
                        continue;
                    }
                    $err = (string) ($result['error'] ?? '');
                    if ($err === '') {
                        continue;
                    }

                    if (!isset($chunk[$idx])) {
                        continue;
                    }

                    if (in_array($err, ['NotRegistered', 'InvalidRegistration', 'MismatchSenderId'], true)) {
                        DeviceToken::query()->where('token', $chunk[$idx])->delete();
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('FCM send exception', [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}

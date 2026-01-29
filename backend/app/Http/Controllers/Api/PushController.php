<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\Request;

class PushController extends Controller
{
    public function vapidPublicKey()
    {
        $key = (string) env('VAPID_PUBLIC_KEY', '');
        return response()->json([
            'publicKey' => $key,
        ]);
    }

    public function subscribe(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        $validated = $request->validate([
            'endpoint' => 'required|string',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
            'contentEncoding' => 'nullable|string|max:30',
        ]);

        $endpoint = (string) $validated['endpoint'];
        $p256dh = (string) ($validated['keys']['p256dh'] ?? '');
        $auth = (string) ($validated['keys']['auth'] ?? '');
        $encoding = (string) ($validated['contentEncoding'] ?? 'aesgcm');

        PushSubscription::updateOrCreate(
            ['endpoint' => $endpoint],
            [
                'user_id' => $user->id,
                'public_key' => $p256dh,
                'auth_token' => $auth,
                'content_encoding' => $encoding,
                'last_used_at' => null,
            ]
        );

        return response()->json(['ok' => true]);
    }

    public function unsubscribe(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        $validated = $request->validate([
            'endpoint' => 'required|string',
        ]);

        PushSubscription::where('user_id', $user->id)
            ->where('endpoint', (string) $validated['endpoint'])
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function test(Request $request, WebPushService $webPush)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        $webPush->sendToUser($user, [
            'title' => 'BADBOYSHOP',
            'body' => 'Notifications activées ✅',
            'url' => '/account',
        ]);

        return response()->json(['ok' => true]);
    }
}

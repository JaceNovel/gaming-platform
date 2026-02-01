<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\HandleFedapayWebhookWallet;
use App\Jobs\ProcessFedaPayWebhook;
use App\Support\FedaPayWebhookSignature;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class FedaPayWebhookController extends Controller
{
    public function handle(Request $request)
    {
        // 1) Read raw body EXACT (never re-encode JSON)
        $raw = (string) $request->getContent();

        // 2) Header + signature verification (NEVER use FEDAPAY_SECRET_KEY here)
        $signatureHeader = (string) $request->header('x-fedapay-signature', '');
        $webhookSecret = (string) env('FEDAPAY_WEBHOOK_SECRET', '');
        if (!FedaPayWebhookSignature::verify($signatureHeader, $raw, $webhookSecret)) {
            return response()->json(['received' => false], Response::HTTP_UNAUTHORIZED);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            Log::error('fedapay:invalid-json', [
                'raw_len' => strlen($raw),
                'raw_sha256' => hash('sha256', $raw),
            ]);

            // ACK anyway (do not trigger retries / do not ever 500)
            return response()->json(['received' => true]);
        }

        // Attach a stable hash of the raw payload for idempotency.
        $payload['_meta'] = is_array($payload['_meta'] ?? null) ? $payload['_meta'] : [];
        $payload['_meta']['raw_hash'] = hash('sha256', $raw);
        $payload['_meta']['received_at'] = now()->toIso8601String();

        try {
            $metaType = (string) (Arr::get($payload, 'custom_metadata.type')
                ?? Arr::get($payload, 'entity.custom_metadata.type')
                ?? '');

            if (strtolower($metaType) === 'wallet_topup') {
                HandleFedapayWebhookWallet::dispatch($payload)->afterResponse();
            } else {
                ProcessFedaPayWebhook::dispatch($payload)->afterResponse();
            }
        } catch (\Throwable $e) {
            Log::error('fedapay:webhook-dispatch-error', [
                'stage' => 'dispatch',
                'message' => $e->getMessage(),
            ]);
        }

        return response()->json(['received' => true]);
    }
}

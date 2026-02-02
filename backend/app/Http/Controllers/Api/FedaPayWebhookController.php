<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        // 1) RAW BODY exact
        $raw = (string) $request->getContent();

        // 2) Header
        $signatureHeader = (string) $request->header('x-fedapay-signature', '');

        // 3) Verify signature (401 JSON on invalid)
        $webhookSecret = (string) env('FEDAPAY_WEBHOOK_SECRET', '');
        $tolerance = (int) env('FEDAPAY_WEBHOOK_TOLERANCE', 300);
        if (!FedaPayWebhookSignature::verifyFedapayWebhookSignature($raw, $signatureHeader, $webhookSecret, $tolerance)) {
            return response()->json(['received' => false], Response::HTTP_UNAUTHORIZED);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            Log::error('fedapay:invalid-json', [
                'raw_len' => strlen($raw),
                'raw_sha256' => hash('sha256', $raw),
            ]);

            // ACK anyway (do not trigger retries / do not ever 500)
            return response()->json(['received' => true, 'ignored' => true]);
        }

        $eventName = strtolower((string) Arr::get($payload, 'name', ''));
        $sigParsed = FedaPayWebhookSignature::parseFedaPaySignatureHeader($signatureHeader);
        $t = (string) ($sigParsed['timestamp'] ?? '');
        $v1Prefix = null;
        if (!empty($sigParsed['v1']) && is_array($sigParsed['v1'])) {
            $first = (string) ($sigParsed['v1'][0] ?? '');
            $v1Prefix = $first !== '' ? substr($first, 0, 8) : null;
        }
        Log::debug('fedapay:webhook', [
            'event' => $eventName,
            't' => $t !== '' ? $t : null,
            'v1_prefix' => $v1Prefix,
            'raw_sha256' => hash('sha256', $raw),
        ]);

        // Attach a stable hash of the raw payload for idempotency.
        $payload['_meta'] = is_array($payload['_meta'] ?? null) ? $payload['_meta'] : [];
        $payload['_meta']['raw_hash'] = hash('sha256', $raw);
        $payload['_meta']['received_at'] = now()->toIso8601String();

        try {
            $metaType = (string) (Arr::get($payload, 'custom_metadata.type')
                ?? Arr::get($payload, 'entity.custom_metadata.type')
                ?? '');

            // Refund events are not supported yet, but must be ACKed.
            if ($eventName === 'refund.sent' || str_starts_with($eventName, 'refund.')) {
                return response()->json(['received' => true, 'ignored' => true]);
            }

            // Wallet topups are no longer supported.
            // ACK the webhook but ignore wallet_topup events completely.
            if (strtolower($metaType) === 'wallet_topup') {
                return response()->json(['received' => true, 'ignored' => true]);
            }

            // Process all transaction.* events (job decides if status is final or pending).
            if (str_starts_with($eventName, 'transaction.')) {
                ProcessFedaPayWebhook::dispatch($payload)->afterResponse();
                return response()->json(['received' => true]);
            }

            return response()->json(['received' => true, 'ignored' => true]);
        } catch (\Throwable $e) {
            Log::error('fedapay:webhook-dispatch-error', [
                'stage' => 'dispatch',
                'message' => $e->getMessage(),
            ]);
        }

        // Always ACK when signature is valid.
        return response()->json(['received' => true, 'ignored' => true]);
    }
}

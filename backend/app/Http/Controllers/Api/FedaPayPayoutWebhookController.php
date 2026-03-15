<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessFedaPayPayoutWebhook;
use App\Support\FedaPayWebhookSignature;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class FedaPayPayoutWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $raw = (string) $request->getContent();
        $signatureHeader = (string) $request->header('x-fedapay-signature', '');
        $webhookSecret = (string) env('FEDAPAY_PAYOUT_WEBHOOK_SECRET', env('FEDAPAY_WEBHOOK_SECRET', ''));
        $tolerance = (int) env('FEDAPAY_PAYOUT_WEBHOOK_TOLERANCE', env('FEDAPAY_WEBHOOK_TOLERANCE', 300));

        if (!FedaPayWebhookSignature::verifyFedapayWebhookSignature($raw, $signatureHeader, $webhookSecret, $tolerance)) {
            return response()->json(['received' => false], Response::HTTP_UNAUTHORIZED);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            return response()->json(['received' => true, 'ignored' => true]);
        }

        $payload['_meta'] = is_array($payload['_meta'] ?? null) ? $payload['_meta'] : [];
        $payload['_meta']['raw_hash'] = hash('sha256', $raw);
        $payload['_meta']['received_at'] = now()->toIso8601String();

        try {
            $eventName = strtolower((string) Arr::get($payload, 'name', ''));
            $object = strtolower((string) (Arr::get($payload, 'object') ?? Arr::get($payload, 'entity.object') ?? ''));

            if (str_starts_with($eventName, 'payout.') || $object === 'payout') {
                ProcessFedaPayPayoutWebhook::dispatch($payload)->afterResponse();
                return response()->json(['received' => true]);
            }

            return response()->json(['received' => true, 'ignored' => true]);
        } catch (\Throwable $e) {
            Log::error('fedapay:payout-webhook-dispatch-error', [
                'message' => $e->getMessage(),
            ]);
        }

        return response()->json(['received' => true, 'ignored' => true]);
    }
}
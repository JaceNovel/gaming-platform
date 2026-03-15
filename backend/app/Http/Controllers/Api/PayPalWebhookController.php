<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\PayPalPaymentSyncService;
use App\Services\PayPalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PayPalWebhookController extends Controller
{
    public function __construct(
        private PayPalService $payPalService,
        private PayPalPaymentSyncService $payPalPaymentSyncService,
    ) {
    }

    public function handle(Request $request)
    {
        $payload = $request->json()->all();
        if (!is_array($payload) || $payload === []) {
            return response()->json(['message' => 'Invalid PayPal webhook payload'], 400);
        }

        $headers = [
            'paypal-transmission-id' => (string) $request->header('PayPal-Transmission-Id', ''),
            'paypal-transmission-time' => (string) $request->header('PayPal-Transmission-Time', ''),
            'paypal-transmission-sig' => (string) $request->header('PayPal-Transmission-Sig', ''),
            'paypal-auth-algo' => (string) $request->header('PayPal-Auth-Algo', ''),
            'paypal-cert-url' => (string) $request->header('PayPal-Cert-Url', ''),
        ];

        try {
            if (!$this->payPalService->verifyWebhookSignature($headers, $payload)) {
                Log::warning('paypal:webhook-signature-invalid', [
                    'event_id' => $payload['id'] ?? null,
                    'event_type' => $payload['event_type'] ?? null,
                ]);

                return response()->json(['message' => 'Invalid PayPal webhook signature'], 401);
            }
        } catch (\Throwable $e) {
            Log::error('paypal:webhook-signature-error', [
                'event_id' => $payload['id'] ?? null,
                'event_type' => $payload['event_type'] ?? null,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'PayPal webhook verification failed'], 500);
        }

        $eventId = trim((string) ($payload['id'] ?? ''));
        $eventType = strtoupper(trim((string) ($payload['event_type'] ?? 'UNKNOWN')));
        $cacheKey = $eventId !== '' ? 'paypal:webhook:' . $eventId : null;

        if ($cacheKey && !Cache::add($cacheKey, true, now()->addHours(12))) {
            return response()->json(['success' => true, 'message' => 'Webhook already processed']);
        }

        $providerOrderId = $this->payPalService->extractWebhookOrderId($payload);
        if (!$providerOrderId) {
            return response()->json(['success' => true, 'message' => 'Webhook ignored']);
        }

        $payment = Payment::with(['order.user', 'walletTransaction'])
            ->where('method', 'paypal')
            ->where('transaction_id', $providerOrderId)
            ->latest('id')
            ->first();

        if (!$payment) {
            Log::info('paypal:webhook-payment-missing', [
                'event_id' => $eventId,
                'event_type' => $eventType,
                'provider_order_id' => $providerOrderId,
            ]);

            return response()->json(['success' => true, 'message' => 'Payment not found']);
        }

        try {
            $status = $this->payPalPaymentSyncService->sync($payment, $eventType === 'CHECKOUT.ORDER.APPROVED', [
                'source' => 'webhook',
                'event_id' => $eventId,
                'event_type' => $eventType,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Webhook processed',
                'data' => [
                    'payment_id' => $payment->id,
                    'provider_order_id' => $providerOrderId,
                    'status' => $status,
                ],
            ]);
        } catch (\Throwable $e) {
            if ($cacheKey) {
                Cache::forget($cacheKey);
            }

            Log::error('paypal:webhook-sync-failed', [
                'event_id' => $eventId,
                'event_type' => $eventType,
                'provider_order_id' => $providerOrderId,
                'payment_id' => $payment->id,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'PayPal webhook processing failed'], 500);
        }
    }
}
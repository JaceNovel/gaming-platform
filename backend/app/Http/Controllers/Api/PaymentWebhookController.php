<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Services\CinetPayService;
use App\Services\ShippingService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class PaymentWebhookController extends Controller
{
    public function __construct(private CinetPayService $cinetPayService)
    {
    }

    public function handle(Request $request)
    {
        $payload = $request->all();
        Log::info('cinetpay:webhook', ['payload' => $payload]);

        if (!$this->cinetPayService->verifyWebhookSignature($payload)) {
            Log::warning('cinetpay:error', ['stage' => 'webhook-signature', 'payload' => $payload]);
            return response()->json(['success' => false, 'message' => 'Invalid signature'], Response::HTTP_BAD_REQUEST);
        }

        $transactionId = $request->input('transaction_id') ?? $request->input('cpm_trans_id');

        if (!$transactionId) {
            return response()->json(['message' => 'transaction_id missing'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $payment = Payment::with(['order' => function ($query) {
            $query->with('orderItems');
        }])->where('transaction_id', $transactionId)->first();

        $attempt = PaymentAttempt::where('transaction_id', $transactionId)->first();

        if (!$payment) {
            Log::warning('cinetpay:error', ['stage' => 'webhook-missing', 'transaction_id' => $transactionId]);
            return response()->json(['message' => 'Payment not found'], Response::HTTP_NOT_FOUND);
        }

        if ($attempt && in_array($attempt->status, ['paid', 'failed'], true)) {
            Log::info('cinetpay:webhook-idempotent', ['transaction_id' => $transactionId, 'status' => $attempt->status]);
            return response()->json(['success' => true, 'message' => 'Webhook already processed']);
        }

        if (in_array($payment->status, ['paid', 'failed'], true)) {
            Log::info('cinetpay:webhook-idempotent', ['payment_id' => $payment->id, 'status' => $payment->status]);
            return response()->json(['success' => true, 'message' => 'Webhook already processed']);
        }

        try {
            $verification = $this->cinetPayService->verifyTransaction($transactionId);
        } catch (\Throwable $e) {
            Log::error('cinetpay:error', [
                'stage' => 'webhook-verify',
                'transaction_id' => $transactionId,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Verification failed'], Response::HTTP_BAD_GATEWAY);
        }

        $normalized = $this->cinetPayService->normalizeStatus($verification, strtoupper($request->input('cpm_trans_status')));

        if ($normalized === 'pending') {
            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => $payment->order_id,
                    'amount' => (float) $payment->amount,
                    'currency' => strtoupper((string) ($payment->order->currency ?? config('cinetpay.default_currency', 'XOF'))),
                    'status' => 'pending',
                    'provider' => 'cinetpay',
                    'raw_payload' => [
                        'webhook' => $payload,
                        'verification' => $verification,
                    ],
                ]
            );

            return response()->json(['success' => true, 'message' => 'Payment pending'], Response::HTTP_ACCEPTED);
        }

        $amountFromProvider = (float) (Arr::get($verification, 'data.amount', $request->input('cpm_amount')));

        if (abs((float) $payment->amount - $amountFromProvider) > 0.01) {
            Log::error('cinetpay:error', [
                'stage' => 'webhook-amount',
                'payment_id' => $payment->id,
                'expected' => $payment->amount,
                'received' => $amountFromProvider,
            ]);

            return response()->json(['message' => 'Amount mismatch'], Response::HTTP_BAD_REQUEST);
        }

        DB::transaction(function () use ($payment, $normalized, $payload, $verification, $transactionId) {
            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['webhook'] = $payload;
            $meta['verification'] = $verification;

            $payment->update([
                'status' => $normalized,
                'webhook_data' => $meta,
            ]);

            $orderStatus = $normalized === 'paid' ? 'paid' : 'failed';
            $payment->order->update(['status' => $orderStatus]);

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => $payment->order_id,
                    'amount' => (float) $payment->amount,
                    'currency' => strtoupper((string) ($payment->order->currency ?? config('cinetpay.default_currency', 'XOF'))),
                    'status' => $normalized,
                    'provider' => 'cinetpay',
                    'processed_at' => now(),
                    'raw_payload' => [
                        'webhook' => $payload,
                        'verification' => $verification,
                    ],
                ]
            );

            if ($normalized === 'paid' && $payment->order->type !== 'wallet_topup') {
                $payment->order->loadMissing('orderItems.product');

                if ($payment->order->hasPhysicalItems()) {
                    app(ShippingService::class)->computeShippingForOrder($payment->order);
                }

                if ($payment->order->requiresRedeemFulfillment()) {
                    ProcessRedeemFulfillment::dispatch($payment->order->id);
                } else {
                    ProcessOrderDelivery::dispatch($payment->order);
                }
            }
        });

        Log::info('cinetpay:webhook-processed', [
            'payment_id' => $payment->id,
            'order_id' => $payment->order_id,
            'status' => $normalized,
        ]);

        return response()->json(['success' => true, 'message' => 'Webhook processed']);
    }

    public function redirect(Request $request)
    {
        $transactionId = $request->query('transaction_id') ?? $request->query('cpm_trans_id');
        $orderId = $request->query('order_id');
        $statusUrl = config('cinetpay.frontend_status_url');

        if ($statusUrl) {
            $query = Arr::query(array_filter([
                'transaction_id' => $transactionId,
                'order_id' => $orderId,
                'provider' => 'cinetpay',
            ], static fn ($value) => !is_null($value) && $value !== ''));

            $target = rtrim($statusUrl, '/');
            $location = $query ? $target . '?' . $query : $target;

            return redirect()->away($location);
        }

        return response()->json([
            'message' => 'Payment processed',
            'transaction_id' => $transactionId,
            'order_id' => $orderId,
        ]);
    }
}

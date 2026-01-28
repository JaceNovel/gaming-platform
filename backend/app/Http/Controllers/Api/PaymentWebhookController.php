<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\PremiumMembership;
use App\Services\CinetPayService;
use App\Services\ShippingService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
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

        if ($attempt && in_array($attempt->status, ['paid', 'completed', 'failed'], true)) {
            Log::info('cinetpay:webhook-idempotent', ['transaction_id' => $transactionId, 'status' => $attempt->status]);
            return response()->json(['success' => true, 'message' => 'Webhook already processed']);
        }

        if (in_array($payment->status, ['paid', 'completed', 'failed'], true)) {
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

            $orderStatus = $normalized === 'completed' ? 'paid' : 'failed';
            $payment->order->update(['status' => $orderStatus]);

            if ($normalized === 'completed' && (string) ($payment->order->type ?? '') === 'premium_subscription') {
                $order = $payment->order->fresh(['user']);
                $orderMeta = $order->meta ?? [];
                if (!is_array($orderMeta)) {
                    $orderMeta = [];
                }

                if (empty($orderMeta['premium_activated_at'])) {
                    $level = (string) ($orderMeta['premium_level'] ?? 'bronze');
                    $gameId = (int) ($orderMeta['game_id'] ?? 0);
                    $gameUsername = (string) ($orderMeta['game_username'] ?? '');

                    if ($gameId > 0 && $gameUsername !== '') {
                        $levels = [
                            'bronze' => ['duration' => 30],
                            'or' => ['duration' => 30],
                            'platine' => ['duration' => 30],
                        ];
                        $duration = $levels[$level]['duration'] ?? 30;

                        $membership = PremiumMembership::updateOrCreate(
                            [
                                'user_id' => $order->user_id,
                                'game_id' => $gameId,
                            ],
                            [
                                'level' => $level,
                                'game_username' => $gameUsername,
                                'expiration_date' => Carbon::now()->addDays($duration),
                                'is_active' => true,
                                'renewal_count' => DB::raw('renewal_count + 1'),
                            ]
                        );

                        $order->user?->update([
                            'is_premium' => true,
                            'premium_level' => $level,
                            'premium_expiration' => $membership->expiration_date,
                        ]);

                        $orderMeta['premium_activated_at'] = now()->toIso8601String();
                        $order->update(['meta' => $orderMeta]);
                    }
                }
            }

            if ($normalized === 'completed' && $payment->order->type !== 'wallet_topup') {
                $payment->order->loadMissing('orderItems');
                $orderMeta = $payment->order->meta ?? [];
                if (!is_array($orderMeta)) {
                    $orderMeta = [];
                }

                if (empty($orderMeta['sales_recorded_at'])) {
                    $items = $payment->order->orderItems;
                    foreach ($items as $item) {
                        if (!$item?->product_id) {
                            continue;
                        }
                        $qty = max(1, (int) ($item->quantity ?? 1));
                        Product::where('id', $item->product_id)->increment('purchases_count');
                        Product::where('id', $item->product_id)->increment('sold_count', $qty);
                    }

                    $orderMeta['sales_recorded_at'] = now()->toIso8601String();
                    $payment->order->update(['meta' => $orderMeta]);
                }
            }

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

            if ($normalized === 'completed' && $payment->order->type !== 'wallet_topup') {
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
        $payment = null;
        if ($transactionId) {
            $payment = Payment::with('order')->where('transaction_id', $transactionId)->latest('id')->first();
        }
        if (!$payment && $orderId) {
            $payment = Payment::with('order')->where('order_id', $orderId)->latest('id')->first();
        }

        $resolvedOrderId = $orderId ?: ($payment?->order_id);

        $defaultStatusUrl = config('cinetpay.frontend_status_url');
        $walletTopupUrl = config('cinetpay.frontend_wallet_topup_url');

        $isWalletTopup = (string) ($payment?->order?->type ?? '') === 'wallet_topup';
        $statusUrl = ($isWalletTopup && $walletTopupUrl) ? $walletTopupUrl : $defaultStatusUrl;

        if ($statusUrl) {
            $query = Arr::query(array_filter([
                'transaction_id' => $transactionId,
                'order_id' => $resolvedOrderId,
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

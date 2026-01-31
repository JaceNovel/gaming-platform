<?php

namespace App\Services;

use App\Jobs\ProcessFedaPayWebhook;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PremiumMembership;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentResyncService
{
    public function __construct(
        private CinetPayService $cinetPayService,
        private ShippingService $shippingService,
    ) {
    }

    /**
     * Resync a payment by querying the provider.
     * Returns the normalized payment status: completed|failed|pending.
     */
    public function resync(Payment $payment, array $context = []): string
    {
        $method = strtolower((string) ($payment->method ?? ''));

        if ($method === 'fedapay') {
            return $this->resyncFedaPay($payment, $context);
        }

        if ($method === 'cinetpay' || $method === '') {
            // Historical records may have empty method for CinetPay.
            return $this->resyncCinetPay($payment, $context);
        }

        throw new \InvalidArgumentException('Unsupported payment method: ' . $method);
    }

    private function resyncFedaPay(Payment $payment, array $context = []): string
    {
        if (!$payment->transaction_id) {
            throw new \RuntimeException('Missing transaction id');
        }

        // Reuse existing strict webhook processor logic.
        $payload = [
            'id' => 'resync-' . (string) Str::uuid(),
            'name' => 'transaction.resync',
            'entity' => [
                'id' => (string) $payment->transaction_id,
            ],
            'meta' => [
                'source' => 'payments_resync',
                'context' => $context,
            ],
        ];

        ProcessFedaPayWebhook::dispatchSync($payload);

        return (string) ($payment->fresh()?->status ?? 'pending');
    }

    private function resyncCinetPay(Payment $payment, array $context = []): string
    {
        if (!$payment->transaction_id) {
            throw new \RuntimeException('Missing transaction id');
        }

        $payment->loadMissing(['order' => function ($query) {
            $query->with(['orderItems.product', 'user']);
        }]);

        $verification = $this->cinetPayService->verifyTransaction((string) $payment->transaction_id);
        $normalized = $this->cinetPayService->normalizeStatus($verification);

        // If provider says completed, enforce amount matching like the webhook.
        if ($normalized === 'completed') {
            $amountFromProvider = (float) (Arr::get($verification, 'data.amount', 0));
            if ($amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) > 0.01) {
                Log::error('cinetpay:resync-amount-mismatch', [
                    'payment_id' => $payment->id,
                    'transaction_id' => $payment->transaction_id,
                    'expected' => (float) $payment->amount,
                    'received' => $amountFromProvider,
                ]);
                $normalized = 'failed';
            }
        }

        DB::transaction(function () use ($payment, $normalized, $verification, $context) {
            /** @var Payment $locked */
            $locked = Payment::with(['order' => function ($query) {
                $query->with(['orderItems.product', 'user']);
            }])->whereKey($payment->id)->lockForUpdate()->firstOrFail();

            // Idempotence: if already final, do nothing.
            if (in_array((string) $locked->status, ['completed', 'failed'], true)) {
                return;
            }

            $meta = $locked->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }

            $meta['resync'] = [
                'at' => now()->toIso8601String(),
                'context' => $context,
                'verification' => $verification,
            ];

            $locked->update([
                'status' => $normalized,
                'webhook_data' => $meta,
            ]);

            if ($locked->order) {
                $order = $locked->order->fresh(['orderItems.product', 'user']);

                if ($normalized === 'completed') {
                    $order->update(['status' => Order::STATUS_PAYMENT_SUCCESS]);
                } elseif ($normalized === 'failed') {
                    $order->update(['status' => Order::STATUS_PAYMENT_FAILED]);
                }

                // Premium activation (same behavior as CinetPay webhook)
                if ($normalized === 'completed' && (string) ($order->type ?? '') === 'premium_subscription') {
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

                // Sales recording (non wallet)
                if ($normalized === 'completed' && (string) ($order->type ?? '') !== 'wallet_topup') {
                    $orderMeta = $order->meta ?? [];
                    if (!is_array($orderMeta)) {
                        $orderMeta = [];
                    }

                    if (empty($orderMeta['sales_recorded_at'])) {
                        foreach ($order->orderItems as $item) {
                            if (!$item?->product_id) {
                                continue;
                            }
                            $qty = max(1, (int) ($item->quantity ?? 1));
                            Product::where('id', $item->product_id)->increment('purchases_count');
                            Product::where('id', $item->product_id)->increment('sold_count', $qty);
                        }

                        $orderMeta['sales_recorded_at'] = now()->toIso8601String();
                        $order->update(['meta' => $orderMeta]);
                    }
                }

                // Fulfillment dispatch (non wallet)
                if ($normalized === 'completed' && (string) ($order->type ?? '') !== 'wallet_topup') {
                    $order->loadMissing('orderItems.product');

                    $orderMeta = $order->meta ?? [];
                    if (!is_array($orderMeta)) {
                        $orderMeta = [];
                    }

                    if (empty($orderMeta['fulfillment_dispatched_at']) && $order->canBeFulfilled()) {
                        if ($order->hasPhysicalItems()) {
                            $this->shippingService->computeShippingForOrder($order);
                        }

                        if ($order->requiresRedeemFulfillment()) {
                            ProcessRedeemFulfillment::dispatchSync($order->id);
                        } else {
                            ProcessOrderDelivery::dispatchSync($order);
                        }

                        $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                        $order->update(['meta' => $orderMeta]);
                    }
                }
            }

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => (string) $locked->transaction_id],
                [
                    'order_id' => $locked->order_id,
                    'amount' => (float) $locked->amount,
                    'currency' => strtoupper((string) ($locked->order->currency ?? config('cinetpay.default_currency', 'XOF'))),
                    'status' => $normalized,
                    'provider' => 'cinetpay',
                    'processed_at' => now(),
                    'raw_payload' => [
                        'resync' => [
                            'context' => $context,
                            'verification' => $verification,
                        ],
                    ],
                ]
            );
        });

        return (string) ($payment->fresh()?->status ?? 'pending');
    }
}

<?php

namespace App\Jobs;

use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\PremiumMembership;
use App\Models\Referral;
use App\Models\Order;
use App\Models\User;
use App\Services\FedaPayService;
use App\Services\ShippingService;
use App\Services\WalletService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProcessFedaPayWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public array $eventPayload)
    {
    }

    public function handle(FedaPayService $fedaPayService, WalletService $walletService, ShippingService $shippingService): void
    {
        $payload = $this->eventPayload;
        $eventName = strtolower((string) (Arr::get($payload, 'name') ?? Arr::get($payload, 'event') ?? ''));
        $eventId = (string) (Arr::get($payload, 'id') ?? Arr::get($payload, 'event_id') ?? '');

        $object = Arr::get($payload, 'object');
        $transactionId = (string) (
            Arr::get($object, 'id')
                ?? Arr::get($payload, 'data.id')
                ?? Arr::get($payload, 'data.transaction.id')
                ?? Arr::get($payload, 'transaction.id')
                ?? ''
        );

        Log::info('fedapay:webhook-job', [
            'event' => $eventName,
            'event_id' => $eventId,
            'transaction_id' => $transactionId,
        ]);

        if ($transactionId === '') {
            Log::warning('fedapay:webhook-skip', ['reason' => 'missing-transaction-id', 'payload' => $payload]);
            return;
        }

        $payment = Payment::with(['order' => function ($q) {
            $q->with(['orderItems.product', 'user']);
        }, 'walletTransaction'])->where('transaction_id', $transactionId)->where('method', 'fedapay')->first();

        if (!$payment) {
            Log::warning('fedapay:webhook-missing', ['transaction_id' => $transactionId]);

            // Track unknown transaction attempts for audit/debug.
            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => null,
                    'amount' => 0,
                    'currency' => strtoupper((string) config('fedapay.default_currency', 'XOF')),
                    'status' => 'failed',
                    'provider' => 'fedapay',
                    'processed_at' => now(),
                    'raw_payload' => [
                        'event_id' => $eventId,
                        'event_name' => $eventName,
                        'webhook' => $payload,
                        'error' => 'payment_not_found',
                    ],
                ]
            );
            return;
        }

        // Idempotence: skip if already final
        if (in_array((string) $payment->status, ['completed', 'failed'], true)) {
            Log::info('fedapay:webhook-idempotent', ['payment_id' => $payment->id, 'status' => $payment->status]);
            return;
        }

        $attempt = PaymentAttempt::where('transaction_id', $transactionId)->first();
        if ($attempt && in_array((string) $attempt->status, ['completed', 'failed'], true)) {
            Log::info('fedapay:webhook-idempotent', ['transaction_id' => $transactionId, 'status' => $attempt->status]);
            return;
        }

        // Always verify with provider API (source of truth)
        $verification = $fedaPayService->retrieveTransaction($transactionId);

        $statusCandidates = array_filter(array_map(static fn ($v) => $v !== null ? strtolower((string) $v) : null, [
            Arr::get($verification, 'status'),
            Arr::get($verification, 'transaction.status'),
            Arr::get($verification, 'data.status'),
            Arr::get($object, 'status'),
        ]));

        // STRICT: paid only if provider status is EXACTLY SUCCESS/APPROVED.
        $isApproved = false;
        foreach ($statusCandidates as $st) {
            if (in_array($st, ['success', 'approved'], true)) {
                $isApproved = true;
                break;
            }
        }

        $amountFromProvider = (float) (
            Arr::get($verification, 'amount')
                ?? Arr::get($verification, 'data.amount')
                ?? Arr::get($verification, 'transaction.amount')
                ?? Arr::get($verification, 'data.transaction.amount')
                ?? 0
        );

        $currencyFromProvider = strtoupper((string) (
            Arr::get($verification, 'currency.iso')
                ?? Arr::get($verification, 'currency')
                ?? Arr::get($verification, 'data.currency.iso')
                ?? Arr::get($verification, 'data.currency')
                ?? ''
        ));
        $expectedCurrency = strtoupper((string) config('fedapay.default_currency', 'XOF'));

        $referenceFromProvider = (string) (
            Arr::get($verification, 'merchant_reference')
                ?? Arr::get($verification, 'data.merchant_reference')
                ?? Arr::get($verification, 'transaction.merchant_reference')
                ?? Arr::get($verification, 'data.transaction.merchant_reference')
                ?? ''
        );

        $referenceMatches = $referenceFromProvider !== ''
            && $payment->order
            && (string) ($payment->order->reference ?? '') !== ''
            && hash_equals((string) $payment->order->reference, $referenceFromProvider);

        $amountMatches = $amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) <= 0.01;
        $currencyMatches = $currencyFromProvider === '' || $currencyFromProvider === $expectedCurrency;

        $isValidPayment = $isApproved && $amountMatches && $currencyMatches && $referenceMatches;

        if (!$amountMatches) {
            Log::error('fedapay:error', [
                'stage' => 'webhook-amount',
                'payment_id' => $payment->id,
                'expected' => (float) $payment->amount,
                'received' => $amountFromProvider,
            ]);

            // Do not mark as paid if amount mismatched
            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => $payment->order_id,
                    'amount' => (float) $payment->amount,
                    'currency' => strtoupper((string) ($payment->order->currency ?? config('fedapay.default_currency', 'XOF'))),
                    'status' => 'failed',
                    'provider' => 'fedapay',
                    'processed_at' => now(),
                    'raw_payload' => [
                        'event_id' => $eventId,
                        'event_name' => $eventName,
                        'webhook' => $payload,
                        'verification' => $verification,
                        'error' => 'amount_mismatch',
                    ],
                ]
            );

            // Continue processing to mark order/payment as failed.
        }

        if (!$currencyMatches) {
            Log::error('fedapay:error', [
                'stage' => 'webhook-currency',
                'payment_id' => $payment->id,
                'expected' => $expectedCurrency,
                'received' => $currencyFromProvider,
            ]);
        }

        if (!$referenceMatches) {
            Log::error('fedapay:error', [
                'stage' => 'webhook-reference',
                'payment_id' => $payment->id,
                'order_id' => $payment->order_id,
                'expected' => (string) ($payment->order?->reference ?? ''),
                'received' => $referenceFromProvider,
            ]);
        }

        $normalized = $isValidPayment ? 'completed' : 'failed';

        DB::transaction(function () use ($payment, $normalized, $payload, $verification, $transactionId, $eventId, $eventName, $walletService, $shippingService) {
            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['webhook'] = $payload;
            $meta['verification'] = $verification;
            $meta['webhook_event'] = array_filter([
                'id' => $eventId,
                'name' => $eventName,
            ]);

            $payment->update([
                'status' => $normalized,
                'webhook_data' => $meta,
            ]);

            if ($payment->order) {
                $order = $payment->order->fresh(['orderItems.product', 'user']);

                $newOrderStatus = $normalized === 'completed'
                    ? Order::STATUS_PAYMENT_SUCCESS
                    : Order::STATUS_PAYMENT_FAILED;

                if ((string) $order->status !== $newOrderStatus) {
                    $order->update(['status' => $newOrderStatus]);
                }

                // Wallet topup
                if ($normalized === 'completed' && (string) ($order->type ?? '') === 'wallet_topup') {
                    $reference = (string) ($payment->walletTransaction?->reference ?? $order->reference ?? '');
                    if ($order?->user && $reference !== '') {
                        $walletService->credit($order->user, $reference, (float) $payment->amount, [
                            'source' => 'fedapay_topup_webhook',
                            'payment_id' => $payment->id,
                            'reason' => 'topup',
                        ]);

                        // Referral commission: sponsor earns a % of the referred user's first deposit.
                        $referral = Referral::where('referred_id', $order->user_id)->lockForUpdate()->first();
                        $alreadyEarned = $referral ? (float) $referral->commission_earned : 0.0;
                        if ($referral && $alreadyEarned <= 0.0) {
                            $referrer = User::where('id', $referral->referrer_id)->first();
                            $isVip = $referrer && (bool) $referrer->is_premium && in_array((string) $referrer->premium_level, ['bronze', 'platine'], true);
                            if ($referrer && $isVip) {
                                $rate = 0.03;
                                $baseAmount = (float) $payment->amount;
                                $commission = round($baseAmount * $rate, 2);

                                if ($commission > 0) {
                                $walletService->credit($referrer, 'REFERRAL-' . $order->id, $commission, [
                                    'type' => $isVip ? 'vip_referral_bonus' : 'referral_bonus',
                                    'referred_user_id' => $order->user_id,
                                    'order_id' => $order->id,
                                    'payment_id' => $payment->id,
                                    'rate' => $rate,
                                    'base_amount' => $baseAmount,
                                ]);

                                    $referral->update([
                                        'commission_earned' => $commission,
                                        'commission_rate' => $rate,
                                        'commission_base_amount' => $baseAmount,
                                        'rewarded_at' => now(),
                                    ]);
                                }
                            }
                        }

                        $orderMeta = $order->meta ?? [];
                        if (!is_array($orderMeta)) {
                            $orderMeta = [];
                        }
                        if (empty($orderMeta['wallet_credited_at'])) {
                            $orderMeta['wallet_credited_at'] = now()->toIso8601String();
                            $order->update(['meta' => $orderMeta]);
                        }
                    }
                }

                // VIP activation
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

                            // Generate referral code for VIP Bronze+ users.
                            $vipUser = $order->user;
                            if ($vipUser && in_array((string) $level, ['bronze', 'platine'], true) && empty($vipUser->referral_code)) {
                                $code = strtoupper(Str::random(8));
                                $tries = 0;
                                while (User::where('referral_code', $code)->exists() && $tries < 6) {
                                    $code = strtoupper(Str::random(8));
                                    $tries++;
                                }
                                if (!User::where('referral_code', $code)->exists()) {
                                    $vipUser->update(['referral_code' => $code]);
                                }
                            }

                            $orderMeta['premium_activated_at'] = now()->toIso8601String();
                            $order->update(['meta' => $orderMeta]);
                        }
                    }
                }

                // Sales + fulfillment (non wallet)
                if ($normalized === 'completed' && (string) ($order->type ?? '') !== 'wallet_topup') {
                    $orderMeta = $order->meta ?? [];
                    if (!is_array($orderMeta)) {
                        $orderMeta = [];
                    }

                    if (empty($orderMeta['sales_recorded_at'])) {
                        foreach ($payment->order->orderItems as $item) {
                            if (!$item?->product_id) {
                                continue;
                            }
                            $qty = max(1, (int) ($item->quantity ?? 1));
                            Product::where('id', $item->product_id)->increment('purchases_count');
                            Product::where('id', $item->product_id)->increment('sold_count', $qty);
                        }
                        $orderMeta['sales_recorded_at'] = now()->toIso8601String();
                    }

                    // Delivery is allowed only for payment_success, and must be idempotent.
                    if (empty($orderMeta['fulfillment_dispatched_at']) && $order->canBeFulfilled()) {
                        if ($order->hasPhysicalItems()) {
                            $shippingService->computeShippingForOrder($order);
                        }

                        if ($order->requiresRedeemFulfillment()) {
                            ProcessRedeemFulfillment::dispatchSync($order->id);
                        } else {
                            ProcessOrderDelivery::dispatchSync($order);
                        }

                        $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                        $order->update(['meta' => $orderMeta]);
                    } elseif (!empty($orderMeta)) {
                        $order->update(['meta' => $orderMeta]);
                    }
                }
            }

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => $payment->order_id,
                    'amount' => (float) $payment->amount,
                    'currency' => strtoupper((string) config('fedapay.default_currency', 'XOF')),
                    'status' => $normalized,
                    'provider' => 'fedapay',
                    'processed_at' => now(),
                    'raw_payload' => [
                        'event_id' => $eventId,
                        'event_name' => $eventName,
                        'webhook' => $payload,
                        'verification' => $verification,
                    ],
                ]
            );
        });

        Log::info('fedapay:webhook-processed', [
            'payment_id' => $payment->id,
            'order_id' => $payment->order_id,
            'status' => $normalized,
            'transaction_id' => $transactionId,
            'processed_at' => now()->toIso8601String(),
        ]);
    }
}

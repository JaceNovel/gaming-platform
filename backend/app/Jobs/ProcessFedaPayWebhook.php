<?php

namespace App\Jobs;

use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\PremiumMembership;
use App\Models\Referral;
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
            return;
        }

        // Idempotence: skip if already final
        if (in_array((string) $payment->status, ['completed', 'failed', 'paid'], true)) {
            Log::info('fedapay:webhook-idempotent', ['payment_id' => $payment->id, 'status' => $payment->status]);
            return;
        }

        $attempt = PaymentAttempt::where('transaction_id', $transactionId)->first();
        if ($attempt && in_array((string) $attempt->status, ['completed', 'failed', 'paid'], true)) {
            Log::info('fedapay:webhook-idempotent', ['transaction_id' => $transactionId, 'status' => $attempt->status]);
            return;
        }

        // Always verify with provider API (source of truth)
        $verification = $fedaPayService->retrieveTransaction($transactionId);
        $normalized = $fedaPayService->normalizeStatus($verification, Arr::get($object, 'status'));

        if ($normalized === 'pending') {
            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => $payment->order_id,
                    'amount' => (float) $payment->amount,
                    'currency' => strtoupper((string) ($payment->order->currency ?? config('fedapay.default_currency', 'XOF'))),
                    'status' => 'pending',
                    'provider' => 'fedapay',
                    'raw_payload' => [
                        'event_id' => $eventId,
                        'event_name' => $eventName,
                        'webhook' => $payload,
                        'verification' => $verification,
                    ],
                ]
            );

            return;
        }

        $amountFromProvider = (float) (
            Arr::get($verification, 'amount')
                ?? Arr::get($verification, 'data.amount')
                ?? Arr::get($verification, 'transaction.amount')
                ?? Arr::get($verification, 'data.transaction.amount')
                ?? 0
        );

        if ($amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) > 0.01) {
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

            return;
        }

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
                $orderStatus = $normalized === 'completed' ? 'paid' : 'failed';
                $payment->order->update(['status' => $orderStatus]);

                // Wallet topup
                if ($normalized === 'completed' && (string) ($payment->order->type ?? '') === 'wallet_topup') {
                    $order = $payment->order->fresh(['user']);
                    $reference = (string) ($payment->walletTransaction?->reference ?? $order->reference ?? '');
                    if ($order?->user && $reference !== '') {
                        $walletService->credit($order->user, $reference, (float) $payment->amount, [
                            'source' => 'fedapay_topup_webhook',
                            'payment_id' => $payment->id,
                            'reason' => 'topup',
                        ]);

                        // VIP referral: sponsor earns 3% of the referred user's first deposit.
                        $referral = Referral::where('referred_id', $order->user_id)->lockForUpdate()->first();
                        $alreadyEarned = $referral ? (float) $referral->commission_earned : 0.0;
                        if ($referral && $alreadyEarned <= 0.0) {
                            $referrer = User::where('id', $referral->referrer_id)->first();
                            $isVip = $referrer && (bool) $referrer->is_premium && in_array((string) $referrer->premium_level, ['bronze', 'platine'], true);
                            $commission = round(((float) $payment->amount) * 0.03, 2);

                            if ($isVip && $commission > 0) {
                                $walletService->credit($referrer, 'REFERRAL-' . $order->id, $commission, [
                                    'type' => 'vip_referral_bonus',
                                    'referred_user_id' => $order->user_id,
                                    'order_id' => $order->id,
                                    'payment_id' => $payment->id,
                                    'rate' => 0.03,
                                    'base_amount' => (float) $payment->amount,
                                ]);

                                $referral->update([
                                    'commission_earned' => $commission,
                                ]);
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
                if ($normalized === 'completed' && (string) ($payment->order->type ?? '') !== 'wallet_topup') {
                    $payment->order->loadMissing('orderItems.product');

                    $orderMeta = $payment->order->meta ?? [];
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

                    if (empty($orderMeta['fulfillment_dispatched_at'])) {
                        if ($payment->order->hasPhysicalItems()) {
                            $shippingService->computeShippingForOrder($payment->order);
                        }

                        if ($payment->order->requiresRedeemFulfillment()) {
                            ProcessRedeemFulfillment::dispatch($payment->order->id);
                        } else {
                            ProcessOrderDelivery::dispatch($payment->order);
                        }

                        $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                    }

                    $payment->order->update(['meta' => $orderMeta]);
                }
            }

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => $payment->order_id,
                    'amount' => (float) $payment->amount,
                    'currency' => strtoupper((string) ($payment->order->currency ?? config('fedapay.default_currency', 'XOF'))),
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
        ]);
    }
}

<?php

namespace App\Jobs;

use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PaymentEvent;
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
use Illuminate\Database\QueryException;
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

        $entity = Arr::get($payload, 'entity');
        if (!is_array($entity)) {
            $entity = [];
        }

        $rawCandidates = [
            // Most integrations store the numeric transaction id.
            Arr::get($entity, 'id'),
            Arr::get($payload, 'object.id'),
            Arr::get($payload, 'data.id'),
            Arr::get($payload, 'data.transaction.id'),
            Arr::get($payload, 'transaction.id'),

            // Some webhooks expose a separate string reference (e.g. trx_xxx).
            Arr::get($entity, 'reference'),
            Arr::get($payload, 'object.reference'),
            Arr::get($payload, 'data.reference'),
            Arr::get($payload, 'data.transaction.reference'),
            Arr::get($payload, 'transaction.reference'),
        ];

        $candidateTransactionIds = array_values(array_unique(array_filter(
            array_map(static fn ($v) => trim((string) $v), $rawCandidates),
            static fn ($v) => $v !== ''
        )));

        $transactionId = (string) ($candidateTransactionIds[0] ?? '');

        $statusFromPayload = strtolower((string) (Arr::get($entity, 'status') ?? Arr::get($payload, 'object.status') ?? ''));
        $orderIdFromPayload = (int) (
            Arr::get($entity, 'custom_metadata.order_id')
                ?? Arr::get($entity, 'custom_metadata.orderId')
                ?? Arr::get($entity, 'metadata.custom_metadata.order_id')
                ?? Arr::get($entity, 'metadata.custom_metadata.orderId')
                ?? Arr::get($payload, 'custom_metadata.order_id')
                ?? Arr::get($payload, 'metadata.custom_metadata.order_id')
                ?? 0
        );
        $amountFromPayload = (float) (Arr::get($entity, 'amount') ?? 0);
        $payloadHash = (string) (Arr::get($payload, '_meta.raw_hash') ?? '');
        if ($payloadHash === '') {
            $payloadHash = hash('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '');
        }

        Log::info('fedapay:webhook-job', [
            'event' => $eventName,
            'event_id' => $eventId,
            'transaction_id' => $transactionId,
            'transaction_candidates' => $candidateTransactionIds,
            'status' => $statusFromPayload,
            'order_id' => $orderIdFromPayload ?: null,
        ]);

        if ($transactionId === '') {
            Log::warning('fedapay:webhook-skip', [
                'reason' => 'missing-transaction-id',
                'event' => $eventName,
                'event_id' => $eventId,
            ]);
            return;
        }

        // Idempotency: record the event and skip if already processed.
        // If migrations haven't been applied yet (missing payment_events table), continue without idempotency.
        $paymentEvent = null;
        try {
            $paymentEvent = PaymentEvent::firstOrCreate(
                [
                    'provider' => 'fedapay',
                    'tx_id' => $transactionId,
                    'event' => $eventName !== '' ? $eventName : null,
                    'payload_hash' => $payloadHash,
                ],
                [
                    'status' => $statusFromPayload !== '' ? $statusFromPayload : null,
                    'order_id' => $orderIdFromPayload ?: null,
                    'payload' => $payload,
                    'received_at' => Arr::get($payload, '_meta.received_at') ? now() : null,
                ]
            );

            if ($paymentEvent->processed_at) {
                Log::info('fedapay:webhook-idempotent', [
                    'transaction_id' => $transactionId,
                    'event' => $eventName,
                    'payload_hash' => $payloadHash,
                ]);
                return;
            }
        } catch (QueryException $e) {
            Log::warning('fedapay:payment-events-unavailable', [
                'transaction_id' => $transactionId,
                'event' => $eventName,
                'message' => $e->getMessage(),
            ]);
        }

        $paymentQuery = Payment::with(['order' => function ($q) {
            $q->with(['orderItems.product', 'user']);
        }, 'walletTransaction'])->where('method', 'fedapay');

        if (count($candidateTransactionIds) > 0) {
            $paymentQuery->whereIn('transaction_id', $candidateTransactionIds);
        } else {
            $paymentQuery->where('transaction_id', $transactionId);
        }

        $payment = $paymentQuery->first();

        if (!$payment) {
            Log::warning('fedapay:webhook-missing', [
                'transaction_id' => $transactionId,
                'transaction_candidates' => $candidateTransactionIds,
                'order_id' => $orderIdFromPayload ?: null,
                'event' => $eventName,
                'event_id' => $eventId,
            ]);

            // Track unknown transaction attempts for audit/debug.
            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => null,
                    'amount' => 0,
                    'currency' => strtoupper((string) config('fedapay.default_currency', 'XOF')),
                    'status' => 'unknown',
                    'provider' => 'fedapay',
                    'processed_at' => now(),
                    'raw_payload' => [
                        'event_id' => $eventId,
                        'event_name' => $eventName,
                        'error' => 'payment_not_found',
                    ],
                ]
            );

            if ($paymentEvent) {
                $paymentEvent->update(['processed_at' => now()]);
            }
            return;
        }

        // Idempotence: treat COMPLETED as final.
        // Do NOT treat FAILED as final because a delayed provider approval webhook may arrive later.
        if ((string) $payment->status === 'completed') {
            Log::info('fedapay:webhook-idempotent', ['payment_id' => $payment->id, 'status' => $payment->status]);
            if ($paymentEvent) {
                $paymentEvent->update(['processed_at' => now()]);
            }
            return;
        }

        $attempt = PaymentAttempt::where('transaction_id', $transactionId)->first();
        if ($attempt && (string) $attempt->status === 'completed') {
            Log::info('fedapay:webhook-idempotent', ['transaction_id' => $transactionId, 'status' => $attempt->status]);
            if ($paymentEvent) {
                $paymentEvent->update(['processed_at' => now()]);
            }
            return;
        }

        // Pending events must not mark the order paid nor failed.
        if (in_array($statusFromPayload, ['pending'], true)) {
            DB::transaction(function () use ($payment, $payload, $eventId, $eventName, $transactionId, $paymentEvent, $statusFromPayload) {
                $meta = $payment->webhook_data ?? [];
                if (!is_array($meta)) {
                    $meta = [];
                }

                $meta['webhook_event'] = array_filter([
                    'id' => $eventId,
                    'name' => $eventName,
                ]);
                $meta['last_webhook'] = [
                    'received_at' => now()->toIso8601String(),
                    'payload_hash' => (string) ($paymentEvent->payload_hash ?? ''),
                    'status' => $statusFromPayload,
                ];

                $payment->update([
                    'status' => 'pending',
                    'webhook_data' => $meta,
                ]);

                PaymentAttempt::updateOrCreate(
                    ['transaction_id' => $transactionId],
                    [
                        'order_id' => $payment->order_id,
                        'amount' => (float) $payment->amount,
                        'currency' => strtoupper((string) config('fedapay.default_currency', 'XOF')),
                        'status' => 'pending',
                        'provider' => 'fedapay',
                        'processed_at' => now(),
                        'raw_payload' => [
                            'event_id' => $eventId,
                            'event_name' => $eventName,
                        ],
                    ]
                );
            });

            if ($paymentEvent) {
                $paymentEvent->update(['processed_at' => now()]);
            }

            Log::info('fedapay:webhook-pending', [
                'payment_id' => $payment->id,
                'order_id' => $payment->order_id,
                'transaction_id' => $transactionId,
            ]);
            return;
        }

        // Verify with provider API (source of truth) for non-pending events.
        $verificationTxId = (string) ($payment->transaction_id ?? $transactionId);
        if ($verificationTxId === '' && $transactionId !== '') {
            $verificationTxId = $transactionId;
        }
        if ($verificationTxId !== '' && !ctype_digit($verificationTxId)) {
            foreach ($candidateTransactionIds as $cand) {
                if ($cand !== '' && ctype_digit($cand)) {
                    $verificationTxId = $cand;
                    break;
                }
            }
        }

        try {
            $verification = $verificationTxId !== '' ? $fedaPayService->retrieveTransaction($verificationTxId) : [];
        } catch (\Throwable $e) {
            Log::error('fedapay:error', [
                'stage' => 'webhook-verification',
                'payment_id' => $payment->id,
                'transaction_id' => (string) ($payment->transaction_id ?? $transactionId),
                'verification_tx_id' => $verificationTxId !== '' ? $verificationTxId : null,
                'message' => $e->getMessage(),
            ]);
            $verification = [];
        }

        $statusCandidates = array_filter(array_map(static fn ($v) => $v !== null ? strtolower((string) $v) : null, [
            Arr::get($verification, 'status'),
            Arr::get($verification, 'transaction.status'),
            Arr::get($verification, 'data.status'),
            Arr::get($verification, 'v1/transaction.status'),
            Arr::get($verification, 'data.v1/transaction.status'),
            Arr::get($verification, 'v1.transaction.status'),
            Arr::get($verification, 'data.v1.transaction.status'),
            $statusFromPayload,
        ]));

        // STRICT: paid only if provider status is EXACTLY SUCCESS/APPROVED.
        $isApproved = false;
        foreach ($statusCandidates as $st) {
            if (in_array($st, ['success', 'approved', 'transferred'], true)) {
                $isApproved = true;
                break;
            }
        }

        $isFailed = false;
        foreach ($statusCandidates as $st) {
            if (in_array($st, ['failed', 'declined', 'canceled', 'cancelled', 'expired', 'refunded'], true)) {
                $isFailed = true;
                break;
            }
        }

        $amountFromProvider = (float) (
            Arr::get($verification, 'amount')
                ?? Arr::get($verification, 'data.amount')
                ?? Arr::get($verification, 'transaction.amount')
                ?? Arr::get($verification, 'data.transaction.amount')
                ?? Arr::get($verification, 'v1/transaction.amount')
                ?? Arr::get($verification, 'data.v1/transaction.amount')
                ?? Arr::get($verification, 'v1.transaction.amount')
                ?? Arr::get($verification, 'data.v1.transaction.amount')
                ?? 0
        );
            if ($amountFromProvider <= 0 && $amountFromPayload > 0) {
                $amountFromProvider = $amountFromPayload;
            }

        $currencyFromProvider = strtoupper((string) (
            Arr::get($verification, 'currency.iso')
                ?? Arr::get($verification, 'currency')
                ?? Arr::get($verification, 'data.currency.iso')
                ?? Arr::get($verification, 'data.currency')
                ?? Arr::get($verification, 'v1/transaction.currency.iso')
                ?? Arr::get($verification, 'v1/transaction.currency')
                ?? Arr::get($verification, 'data.v1/transaction.currency.iso')
                ?? Arr::get($verification, 'data.v1/transaction.currency')
                ?? Arr::get($verification, 'v1.transaction.currency.iso')
                ?? Arr::get($verification, 'v1.transaction.currency')
                ?? Arr::get($verification, 'data.v1.transaction.currency.iso')
                ?? Arr::get($verification, 'data.v1.transaction.currency')
                ?? ''
        ));
        $expectedCurrency = strtoupper((string) config('fedapay.default_currency', 'XOF'));

        $referenceFromProvider = (string) (
            Arr::get($verification, 'merchant_reference')
                ?? Arr::get($verification, 'data.merchant_reference')
                ?? Arr::get($verification, 'transaction.merchant_reference')
                ?? Arr::get($verification, 'data.transaction.merchant_reference')
                ?? Arr::get($verification, 'v1/transaction.merchant_reference')
                ?? Arr::get($verification, 'data.v1/transaction.merchant_reference')
                ?? Arr::get($verification, 'v1.transaction.merchant_reference')
                ?? Arr::get($verification, 'data.v1.transaction.merchant_reference')
                ?? ''
        );

        $orderIdFromProvider = (int) (
            Arr::get($verification, 'custom_metadata.order_id')
                ?? Arr::get($verification, 'data.custom_metadata.order_id')
                ?? Arr::get($verification, 'transaction.custom_metadata.order_id')
                ?? Arr::get($verification, 'data.transaction.custom_metadata.order_id')
                ?? Arr::get($verification, 'v1/transaction.custom_metadata.order_id')
                ?? Arr::get($verification, 'data.v1/transaction.custom_metadata.order_id')
                ?? Arr::get($verification, 'v1.transaction.custom_metadata.order_id')
                ?? Arr::get($verification, 'data.v1.transaction.custom_metadata.order_id')
                ?? 0
        );

        $referenceMatches = $referenceFromProvider !== ''
            && $payment->order
            && (string) ($payment->order->reference ?? '') !== ''
            && hash_equals((string) $payment->order->reference, $referenceFromProvider);

        $orderIdMatches = $payment->order_id
            && (
                ($orderIdFromProvider > 0 && (int) $payment->order_id === $orderIdFromProvider)
                || ($orderIdFromPayload > 0 && (int) $payment->order_id === $orderIdFromPayload)
            );

        $amountMatches = $amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) <= 0.01;
        $currencyMatches = $currencyFromProvider === '' || $currencyFromProvider === $expectedCurrency;

        // Heuristic: some providers may return amounts in minor units (x100). If so, normalize before comparing.
        // This keeps us strict while avoiding false negatives.
        if (!$amountMatches && $amountFromProvider > 0 && (float) $payment->amount > 0) {
            $asMajor = $amountFromProvider / 100;
            if (abs((float) $payment->amount - $asMajor) <= 0.01) {
                $amountFromProvider = $asMajor;
                $amountMatches = true;
            }
        }

        // We require APPROVED + amount/currency match.
        // Prefer merchant_reference/custom_metadata.order_id matches when available, but also accept a direct
        // transaction_id match because we already located this Payment record by that transaction id.
        $matchedByTransactionId = (string) $payment->transaction_id !== ''
            && (in_array((string) $payment->transaction_id, $candidateTransactionIds, true)
                || hash_equals((string) $payment->transaction_id, $transactionId));

        // Some provider schemas omit merchant_reference in /transactions/{id}; custom_metadata.order_id is usually stable.
        $isValidPayment = $isApproved && $amountMatches && $currencyMatches && ($referenceMatches || $orderIdMatches || $matchedByTransactionId);

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

        if (!$referenceMatches && !$orderIdMatches && !$matchedByTransactionId) {
            Log::error('fedapay:error', [
                'stage' => 'webhook-reference',
                'payment_id' => $payment->id,
                'order_id' => $payment->order_id,
                'expected' => (string) ($payment->order?->reference ?? ''),
                'received' => $referenceFromProvider,
                'order_id_from_provider' => $orderIdFromProvider ?: null,
                'order_id_from_payload' => $orderIdFromPayload ?: null,
            ]);
        }

        $normalized = $isValidPayment ? 'completed' : ($isFailed ? 'failed' : 'pending');

        if ($normalized === 'pending') {
            // Unknown/intermediate state; do not fail the order.
            DB::transaction(function () use ($payment, $payload, $verification, $transactionId, $eventId, $eventName, $paymentEvent) {
                $meta = $payment->webhook_data ?? [];
                if (!is_array($meta)) {
                    $meta = [];
                }
                $meta['webhook_event'] = array_filter([
                    'id' => $eventId,
                    'name' => $eventName,
                ]);
                $meta['verification'] = $verification;

                $payment->update([
                    'status' => 'pending',
                    'webhook_data' => $meta,
                ]);

                PaymentAttempt::updateOrCreate(
                    ['transaction_id' => $transactionId],
                    [
                        'order_id' => $payment->order_id,
                        'amount' => (float) $payment->amount,
                        'currency' => strtoupper((string) config('fedapay.default_currency', 'XOF')),
                        'status' => 'pending',
                        'provider' => 'fedapay',
                        'processed_at' => now(),
                        'raw_payload' => [
                            'event_id' => $eventId,
                            'event_name' => $eventName,
                            'verification' => $verification,
                        ],
                    ]
                );
            });

            if ($paymentEvent) {
                $paymentEvent->update(['processed_at' => now()]);
            }
            return;
        }

        DB::transaction(function () use ($payment, $normalized, $payload, $verification, $transactionId, $eventId, $eventName, $walletService, $shippingService, $paymentEvent) {
            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
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
                if ((string) ($order->type ?? '') === 'wallet_topup') {
                    $reference = (string) ($payment->walletTransaction?->reference ?? $order->reference ?? '');
                    if ($normalized === 'failed') {
                        if ($payment->walletTransaction) {
                            $payment->walletTransaction->update(['status' => 'failed']);
                        }
                    } elseif ($normalized === 'completed' && $order?->user && $reference !== '') {
                        $walletService->credit($order->user, $reference, (float) $payment->amount, [
                            'source' => 'fedapay_topup_webhook',
                            'payment_id' => $payment->id,
                            'reason' => 'topup',
                        ]);

                        // Referral commission: sponsor earns a % of the referred user's first deposit.
                        // Best-effort only: never block wallet topup crediting if referral tables/configs are missing.
                        try {
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
                        } catch (\Throwable $e) {
                            Log::warning('fedapay:referral-skip', [
                                'order_id' => $order->id,
                                'payment_id' => $payment->id,
                                'message' => $e->getMessage(),
                            ]);
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
                        'verification' => $verification,
                    ],
                ]
            );

            Log::info('fedapay:webhook-processed', [
                'payment_id' => $payment->id,
                'order_id' => $payment->order_id,
                'transaction_id' => $transactionId,
                'normalized' => $normalized,
            ]);

            if ($paymentEvent) {
                $paymentEvent->update(['processed_at' => now()]);
            }
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

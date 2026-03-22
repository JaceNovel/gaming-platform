<?php

namespace App\Services;

use App\Jobs\ProcessMarketplaceOrder;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Jobs\SendOrderPaidSms;
use App\Models\EmailLog;
use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PremiumMembership;
use App\Models\Product;
use App\Models\SellerListing;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentSettlementService
{
    public function __construct(
        private WalletService $walletService,
        private ShippingService $shippingService,
    ) {
    }

    public function settle(Payment $payment, string $normalized, array $context = []): array
    {
        $provider = strtolower(trim((string) ($context['provider'] ?? $payment->method ?? 'payment')));
        $attemptCurrency = strtoupper(trim((string) ($context['attempt_currency'] ?? 'XOF')));
        $providerTransactionId = trim((string) ($context['provider_transaction_id'] ?? $payment->transaction_id ?? ''));
        $providerPayload = $context['provider_payload'] ?? null;
        $captureId = trim((string) ($context['capture_id'] ?? ''));

        return DB::transaction(function () use ($payment, $normalized, $provider, $attemptCurrency, $providerTransactionId, $providerPayload, $captureId) {
            /** @var Payment $locked */
            $locked = Payment::with(['order.user', 'order.orderItems.product', 'walletTransaction'])
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            $currentStatus = strtolower((string) ($locked->status ?? 'pending'));
            if (in_array($currentStatus, ['completed', 'failed'], true)) {
                return [
                    'payment_id' => $locked->id,
                    'order_id' => $locked->order_id,
                    'payment_status' => $currentStatus,
                    'order_status' => (string) ($locked->order?->status ?? ''),
                    'already_final' => true,
                ];
            }

            $meta = $locked->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }

            $meta['provider_sync'] = array_filter([
                'provider' => $provider,
                'normalized_status' => $normalized,
                'provider_payload' => $providerPayload,
                'capture_id' => $captureId !== '' ? $captureId : null,
                'synced_at' => now()->toIso8601String(),
            ], static fn ($value) => $value !== null && $value !== '');

            if ($providerTransactionId !== '' && empty($locked->transaction_id)) {
                $locked->transaction_id = $providerTransactionId;
            }

            $locked->status = $normalized;
            $locked->webhook_data = $meta;
            $locked->save();

            $order = $locked->order?->fresh(['orderItems.product', 'user']);
            if ($order) {
                if ($normalized === 'completed') {
                    if ((string) $order->status !== Order::STATUS_PAYMENT_SUCCESS) {
                        $order->update(['status' => Order::STATUS_PAYMENT_SUCCESS]);
                    }

                    $this->handleCompletedOrder($order, $locked, $provider);
                } elseif ($normalized === 'failed') {
                    if ((string) $order->status !== Order::STATUS_PAYMENT_FAILED) {
                        $order->update(['status' => Order::STATUS_PAYMENT_FAILED]);
                    }

                    if ((string) ($order->type ?? '') === 'wallet_topup' && $locked->walletTransaction) {
                        $locked->walletTransaction->update(['status' => 'failed']);
                    }
                }
            }

            if ($providerTransactionId !== '') {
                PaymentAttempt::updateOrCreate(
                    ['transaction_id' => $providerTransactionId],
                    [
                        'order_id' => $locked->order_id,
                        'amount' => (float) $locked->amount,
                        'currency' => $attemptCurrency !== '' ? $attemptCurrency : 'XOF',
                        'status' => $normalized,
                        'provider' => $provider,
                        'processed_at' => now(),
                        'raw_payload' => is_array($providerPayload)
                            ? $providerPayload
                            : ['provider_payload' => $providerPayload],
                    ]
                );
            }

            return [
                'payment_id' => $locked->id,
                'order_id' => $locked->order_id,
                'payment_status' => (string) $locked->status,
                'order_status' => (string) ($order?->status ?? ''),
                'already_final' => false,
            ];
        });
    }

    public function ensureWalletTopupCredited(Payment $payment, array $context = []): bool
    {
        $source = strtolower(trim((string) ($context['source'] ?? $payment->method ?? 'payment')));

        return (bool) DB::transaction(function () use ($payment, $source) {
            /** @var Payment|null $locked */
            $locked = Payment::with(['order.user', 'walletTransaction'])
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->first();

            if (!$locked) {
                return false;
            }

            $order = $locked->order;
            if (!$order || (string) ($order->type ?? '') !== 'wallet_topup') {
                return false;
            }

            if ((string) ($locked->status ?? '') !== 'completed') {
                return false;
            }

            if ((string) $order->status !== Order::STATUS_PAYMENT_SUCCESS) {
                $order->update(['status' => Order::STATUS_PAYMENT_SUCCESS]);
            }

            $reference = (string) ($locked->walletTransaction?->reference ?? $order->reference ?? '');
            if (!$order->user || $reference === '') {
                return false;
            }

            $this->walletService->credit($order->user, $reference, (float) $locked->amount, [
                'source' => $source . '_topup_reconcile',
                'payment_id' => $locked->id,
                'reason' => 'topup',
                'type' => 'wallet_topup',
            ]);

            if ($locked->walletTransaction) {
                $walletTransactionUpdates = [
                    'status' => 'success',
                ];

                if (empty($locked->walletTransaction->paid_at)) {
                    $walletTransactionUpdates['paid_at'] = now();
                }

                if (empty($locked->walletTransaction->provider_transaction_id) && !empty($locked->transaction_id)) {
                    $walletTransactionUpdates['provider_transaction_id'] = (string) $locked->transaction_id;
                }

                $locked->walletTransaction->update($walletTransactionUpdates);
            }

            $orderMeta = $order->meta ?? [];
            if (!is_array($orderMeta)) {
                $orderMeta = [];
            }

            if (empty($orderMeta['wallet_credited_at'])) {
                $orderMeta['wallet_credited_at'] = now()->toIso8601String();
                $order->update(['meta' => $orderMeta]);
            }

            return true;
        });
    }

    private function handleCompletedOrder(Order $order, Payment $payment, string $provider): void
    {
        $orderType = (string) ($order->type ?? '');

        if ($orderType !== 'wallet_topup') {
            SendOrderPaidSms::dispatch($order->id)->afterCommit();

            DB::afterCommit(function () use ($order, $payment, $provider) {
                try {
                    /** @var ReferralCommissionService $referrals */
                    $referrals = app(ReferralCommissionService::class);
                    $referrals->applyForPaidOrderId((int) $order->id, [
                        'source' => $provider . '_payment',
                        'payment_id' => $payment->id,
                    ]);
                } catch (\Throwable $e) {
                    Log::warning($provider . ':referral-commission-skip', [
                        'order_id' => $order->id,
                        'payment_id' => $payment->id,
                        'message' => $e->getMessage(),
                    ]);
                }
            });
        }

        if ($orderType === 'wallet_topup') {
            $reference = (string) ($payment->walletTransaction?->reference ?? $order->reference ?? '');
            if ($order->user && $reference !== '') {
                $this->walletService->credit($order->user, $reference, (float) $payment->amount, [
                    'source' => $provider . '_topup',
                    'payment_id' => $payment->id,
                    'reason' => 'topup',
                ]);

                $orderMeta = $order->meta ?? [];
                if (!is_array($orderMeta)) {
                    $orderMeta = [];
                }
                if (empty($orderMeta['wallet_credited_at'])) {
                    $orderMeta['wallet_credited_at'] = now()->toIso8601String();
                    $order->update(['meta' => $orderMeta]);
                }
            }

            return;
        }

        if ($orderType === 'premium_subscription') {
            $this->activateLegacyPremiumSubscription($order, $payment, $provider);
            return;
        }

        if (in_array($orderType, ['purchase', 'redeem_purchase'], true)) {
            $this->queueAdminOrderPaidNotification($order, $payment, $provider, 'recharges', 'Nouvelle commande payee');
        } elseif ($orderType === 'marketplace_gaming_account') {
            $this->queueAdminOrderPaidNotification($order, $payment, $provider, 'sellers', 'Nouvelle commande marketplace payee');
        }

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
        }

        if (empty($orderMeta['fulfillment_dispatched_at']) && $order->canBeFulfilled()) {
            if ($order->hasPhysicalItems()) {
                $this->shippingService->computeShippingForOrder($order);
                app(SourcingDemandService::class)->syncForPaidOrder($order);
                try {
                    $this->shippingService->generateShippingMarkPdf($order);
                } catch (\RuntimeException) {
                    // Direct-delivery orders do not use transit shipping marks.
                }
            }

            if ($order->requiresRedeemFulfillment()) {
                ProcessRedeemFulfillment::dispatchSync($order->id);
            } else {
                ProcessOrderDelivery::dispatchSync($order);
            }

            $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
            $order->update(['meta' => $orderMeta]);
        } elseif (!empty($orderMeta['fulfillment_dispatched_at']) && $orderType === 'marketplace_gaming_account' && $order->canBeFulfilled()) {
            $exists = MarketplaceOrder::query()->where('order_id', $order->id)->exists();
            if (!$exists) {
                ProcessMarketplaceOrder::dispatchSync($order);
            }
        } elseif (!empty($orderMeta)) {
            $order->update(['meta' => $orderMeta]);
        }
    }

    private function activateLegacyPremiumSubscription(Order $order, Payment $payment, string $provider): void
    {
        $orderMeta = $order->meta ?? [];
        if (!is_array($orderMeta)) {
            $orderMeta = [];
        }

        if (!empty($orderMeta['premium_activated_at'])) {
            return;
        }

        $level = (string) ($orderMeta['premium_level'] ?? 'bronze');
        $gameId = (int) ($orderMeta['game_id'] ?? 0);
        $gameUsername = (string) ($orderMeta['game_username'] ?? '');

        if ($gameId <= 0 || $gameUsername === '') {
            return;
        }

        $levels = [
            'bronze' => ['duration' => 7],
            'platine' => ['duration' => 30],
        ];
        $duration = $levels[$level]['duration'] ?? 30;

        $base = Carbon::now();
        $currentExpiration = $order->user?->premium_expiration;
        if ($currentExpiration) {
            $current = $currentExpiration instanceof Carbon
                ? $currentExpiration
                : Carbon::parse((string) $currentExpiration);
            if ($current->greaterThan($base)) {
                $base = $current;
            }
        }

        $expiresAt = $base->copy()->addDays((int) $duration);

        PremiumMembership::updateOrCreate(
            [
                'user_id' => $order->user_id,
                'game_id' => $gameId,
            ],
            [
                'level' => $level,
                'game_username' => $gameUsername,
                'expiration_date' => $expiresAt,
                'is_active' => true,
                'renewal_count' => DB::raw('renewal_count + 1'),
            ]
        );

        $order->user?->update([
            'is_premium' => true,
            'premium_level' => $level,
            'premium_expiration' => $expiresAt,
        ]);

        $vipUser = $order->user;
        if ($vipUser && in_array($level, ['bronze', 'platine'], true) && empty($vipUser->referral_code)) {
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

        $frontendUrl = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        DB::afterCommit(function () use ($order, $payment, $level, $gameUsername, $expiresAt, $frontendUrl, $provider) {
            try {
                app(AdminResponsibilityService::class)->notify(
                    'subscriptions',
                    'admin_subscription_paid',
                    'Nouvel abonnement Premium paye',
                    [
                        'headline' => 'Abonnement Premium active',
                        'intro' => 'Un paiement d\'abonnement a ete valide et le compte a ete active.',
                        'details' => [
                            ['label' => 'Client', 'value' => (string) ($order->user?->name ?? 'Utilisateur')],
                            ['label' => 'Email', 'value' => (string) ($order->user?->email ?? '—')],
                            ['label' => 'Niveau', 'value' => strtoupper((string) $level)],
                            ['label' => 'Compte jeu', 'value' => (string) $gameUsername],
                            ['label' => 'Reference', 'value' => (string) ($order->reference ?? '—')],
                            ['label' => 'Montant', 'value' => number_format((float) ($payment->amount ?? 0), 0, ',', ' ') . ' FCFA'],
                            ['label' => 'Provider', 'value' => strtoupper($provider)],
                            ['label' => 'Expiration', 'value' => $expiresAt->toDateString()],
                        ],
                        'actionUrl' => $frontendUrl . '/admin/orders/' . $order->id,
                        'actionText' => 'Voir la commande',
                    ],
                    [
                        'order' => $order->toArray(),
                        'payment' => $payment->toArray(),
                        'user' => $order->user?->toArray() ?? [],
                        'premium_level' => $level,
                        'game_username' => $gameUsername,
                    ],
                    [
                        'order_id' => $order->id,
                        'payment_id' => $payment->id,
                    ]
                );
            } catch (\Throwable $e) {
                Log::warning($provider . ':subscription-admin-notify-failed', [
                    'order_id' => $order->id,
                    'payment_id' => $payment->id,
                    'message' => $e->getMessage(),
                ]);
            }
        });
    }

    private function queueAdminOrderPaidNotification(
        Order $order,
        Payment $payment,
        string $provider,
        string $responsibility,
        string $subject
    ): void {
        $frontendUrl = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $orderType = (string) ($order->type ?? '');
        $actionUrl = $orderType === 'marketplace_gaming_account'
            ? $frontendUrl . '/admin/marketplace/orders'
            : $frontendUrl . '/admin/orders/' . $order->id;

        $headline = $orderType === 'marketplace_gaming_account'
            ? 'Commande marketplace payee'
            : 'Nouvelle commande payee';

        $intro = $orderType === 'marketplace_gaming_account'
            ? 'Une commande marketplace vient d etre payee sur la plateforme.'
            : 'Une nouvelle commande client vient d etre payee sur le site.';

        $notificationType = $orderType === 'marketplace_gaming_account'
            ? 'admin_marketplace_order_paid'
            : 'admin_order_paid';

        $itemSummary = $this->summarizeOrderItems($order);

        DB::afterCommit(function () use ($order, $payment, $provider, $responsibility, $subject, $headline, $intro, $actionUrl, $notificationType, $itemSummary) {
            try {
                app(AdminResponsibilityService::class)->notify(
                    $responsibility,
                    $notificationType,
                    $subject,
                    [
                        'headline' => $headline,
                        'intro' => $intro,
                        'details' => array_values(array_filter([
                            ['label' => 'Reference', 'value' => (string) ($order->reference ?? ('#' . $order->id))],
                            ['label' => 'Client', 'value' => (string) ($order->user?->name ?? 'Utilisateur')],
                            ['label' => 'Email', 'value' => (string) ($order->user?->email ?? '—')],
                            $itemSummary !== '' ? ['label' => 'Articles', 'value' => $itemSummary] : null,
                            ['label' => 'Montant', 'value' => number_format((float) ($payment->amount ?? 0), 0, ',', ' ') . ' FCFA'],
                            ['label' => 'Provider', 'value' => strtoupper($provider)],
                            ['label' => 'Type', 'value' => (string) ($order->type ?? 'purchase')],
                        ])),
                        'actionUrl' => $actionUrl,
                        'actionText' => 'Voir la commande',
                    ],
                    [
                        'order' => $order->toArray(),
                        'payment' => $payment->toArray(),
                        'user' => $order->user?->toArray() ?? [],
                    ],
                    [
                        'order_id' => $order->id,
                        'payment_id' => $payment->id,
                    ]
                );
            } catch (\Throwable $e) {
                Log::warning($provider . ':admin-order-notify-failed', [
                    'order_id' => $order->id,
                    'payment_id' => $payment->id,
                    'responsibility' => $responsibility,
                    'message' => $e->getMessage(),
                ]);
            }
        });
    }

    private function summarizeOrderItems(Order $order): string
    {
        $labels = $order->orderItems
            ->map(function ($item) {
                $label = trim((string) ($item->product?->name ?? $item->product?->title ?? ''));
                if ($label === '') {
                    $label = 'Produit #' . ($item->product_id ?? 'n/a');
                }

                $quantity = max(1, (int) ($item->quantity ?? 1));

                return $quantity > 1 ? ($label . ' x' . $quantity) : $label;
            })
            ->filter()
            ->values();

        if ($labels->isEmpty()) {
            return '';
        }

        $visible = $labels->take(3)->all();
        $summary = implode(', ', $visible);
        $remaining = $labels->count() - count($visible);

        if ($remaining > 0) {
            $summary .= ' +' . $remaining;
        }

        return $summary;
    }
}
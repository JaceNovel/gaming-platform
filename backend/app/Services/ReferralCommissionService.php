<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Referral;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReferralCommissionService
{
    public function __construct(private WalletService $walletService)
    {
    }

    /**
     * Apply referral commission when a referred user pays an order.
     *
     * Rules:
     * - Triggered on any paid purchase (order.status = payment_success), regardless of payment method.
     * - Excludes wallet_topup orders.
     * - VIP sponsor rate = 3%, Standard sponsor rate = 1%.
     * - Idempotent per order via wallet transaction reference REFERRAL-{order_id}.
     */
    public function applyForPaidOrderId(int $orderId, array $context = []): void
    {
        $order = Order::query()->with(['user'])->find($orderId);
        if (!$order) {
            return;
        }

        $this->applyForPaidOrder($order, $context);
    }

    public function applyForPaidOrder(Order $order, array $context = []): void
    {
        try {
            if ((string) ($order->status ?? '') !== Order::STATUS_PAYMENT_SUCCESS) {
                return;
            }

            if ((string) ($order->type ?? '') === 'wallet_topup') {
                return;
            }

            $buyerId = (int) ($order->user_id ?? 0);
            if ($buyerId <= 0) {
                return;
            }

            $reference = 'REFERRAL-' . (int) $order->id;

            DB::transaction(function () use ($buyerId, $order, $reference, $context) {
                $referral = Referral::query()
                    ->where('referred_id', $buyerId)
                    ->lockForUpdate()
                    ->first();

                if (!$referral) {
                    return;
                }

                $referrer = User::query()->whereKey($referral->referrer_id)->first();
                if (!$referrer) {
                    return;
                }

                if ((int) $referrer->id === (int) $buyerId) {
                    return;
                }

                // If the wallet tx already exists, do not double count.
                $existingTx = WalletTransaction::query()
                    ->where('reference', $reference)
                    ->lockForUpdate()
                    ->first();

                if ($existingTx && (string) $existingTx->status === 'success') {
                    $meta = $existingTx->meta;
                    if (!is_array($meta)) {
                        $meta = [];
                    }

                    if (!empty($meta['referral_recorded'])) {
                        return;
                    }

                    $this->recordReferralFromTx($referral, $existingTx, $meta);
                    return;
                }

                $isVip = (bool) ($referrer->is_premium ?? false)
                    && in_array((string) ($referrer->premium_level ?? ''), ['bronze', 'or', 'platine'], true);

                $rate = $isVip ? 0.03 : 0.01;

                $baseAmount = (float) ($order->total_price ?? 0);
                if (!is_finite($baseAmount) || $baseAmount <= 0) {
                    return;
                }

                $commission = round($baseAmount * $rate, 2);
                if ($commission <= 0) {
                    return;
                }

                $tx = $this->walletService->credit($referrer, $reference, $commission, array_filter([
                    'type' => $isVip ? 'vip_referral_bonus' : 'referral_bonus',
                    'referred_user_id' => $buyerId,
                    'order_id' => (int) $order->id,
                    'payment_id' => $order->payment_id,
                    'rate' => $rate,
                    'base_amount' => $baseAmount,
                    'source' => $context['source'] ?? 'referral_on_paid_order',
                    'context' => $context,
                ]));

                $lockedTx = WalletTransaction::query()->whereKey($tx->id)->lockForUpdate()->first();
                if (!$lockedTx || (string) ($lockedTx->status ?? '') !== 'success') {
                    return;
                }

                $meta = $lockedTx->meta;
                if (!is_array($meta)) {
                    $meta = [];
                }

                if (!empty($meta['referral_recorded'])) {
                    return;
                }

                $this->recordReferralFromTx($referral, $lockedTx, $meta);
            });
        } catch (\Throwable $e) {
            Log::warning('referrals:commission-skip', [
                'order_id' => $order->id ?? null,
                'user_id' => $order->user_id ?? null,
                'message' => $e->getMessage(),
                'context' => $context,
            ]);
        }
    }

    private function recordReferralFromTx(Referral $referral, WalletTransaction $tx, array $txMeta): void
    {
        $amount = (float) ($tx->amount ?? 0);
        if (!is_finite($amount) || $amount <= 0) {
            return;
        }

        $current = (float) ($referral->commission_earned ?? 0);
        $referral->commission_earned = round($current + $amount, 2);

        $rate = $txMeta['rate'] ?? null;
        $baseAmount = $txMeta['base_amount'] ?? null;

        if (is_numeric($rate)) {
            $referral->commission_rate = (float) $rate;
        }
        if (is_numeric($baseAmount)) {
            $referral->commission_base_amount = (float) $baseAmount;
        }

        $referral->rewarded_at = $referral->rewarded_at ?? now();
        $referral->save();

        $txMeta['referral_recorded'] = true;
        $tx->meta = $txMeta;
        $tx->save();
    }
}

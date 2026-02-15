<?php

namespace App\Console\Commands;

use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use App\Models\Refund;
use App\Services\WalletService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AutoRefundOverdueMarketplaceOrders extends Command
{
    protected $signature = 'marketplace:auto-refund-overdue {--limit=200 : Maximum overdue orders to process per run}';

    protected $description = 'Auto-refund overdue marketplace orders (deadline exceeded) to buyer DB Wallet and flag admin issue';

    public function handle(WalletService $walletService): int
    {
        $limit = max(1, min(1000, (int) $this->option('limit')));

        $ids = MarketplaceOrder::query()
            ->where('status', 'paid')
            ->whereNotNull('delivery_deadline_at')
            ->where('delivery_deadline_at', '<=', now())
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id');

        if ($ids->isEmpty()) {
            $this->info('No overdue marketplace orders to refund.');
            return self::SUCCESS;
        }

        $processed = 0;
        $skipped = 0;

        foreach ($ids as $id) {
            $done = DB::transaction(function () use ($id, $walletService) {
                /** @var MarketplaceOrder|null $mpOrder */
                $mpOrder = MarketplaceOrder::query()
                    ->with(['order.user'])
                    ->lockForUpdate()
                    ->find($id);

                if (!$mpOrder) {
                    return false;
                }

                if ($mpOrder->status !== 'paid') {
                    return false;
                }

                if (!$mpOrder->delivery_deadline_at || $mpOrder->delivery_deadline_at->isFuture()) {
                    return false;
                }

                $order = $mpOrder->order;
                if (!$order || !$order->isPaymentSuccess() || !$order->user) {
                    return false;
                }

                $amount = (float) ($order->total_price ?? $mpOrder->price ?? 0);
                if (!is_finite($amount) || $amount <= 0) {
                    return false;
                }

                $walletReference = 'REFUND-ACCOUNT-MP-' . $mpOrder->id;
                $refundReference = 'RFD-MP-OVERDUE-' . $order->id;

                $walletService->credit($order->user, $walletReference, $amount, [
                    'reason' => 'refund',
                    'type' => 'marketplace_account_refund',
                    'order_id' => $order->id,
                    'marketplace_order_id' => $mpOrder->id,
                    'refund_reference' => $refundReference,
                    'label' => 'Remboursement Account',
                    'trigger' => 'auto_overdue_24h',
                ]);

                Refund::query()->firstOrCreate(
                    ['reference' => $refundReference],
                    [
                        'order_id' => $order->id,
                        'user_id' => $order->user_id,
                        'amount' => $amount,
                        'reason' => 'Remboursement Account (livraison vendeur en retard > 24h)',
                        'status' => 'success',
                    ]
                );

                $refundedAmount = (float) ($order->refunded_amount ?? 0);
                $paidAmount = (float) ($order->total_price ?? 0);
                if (!is_finite($refundedAmount) || $refundedAmount < 0) {
                    $refundedAmount = 0;
                }
                if (!is_finite($paidAmount) || $paidAmount < 0) {
                    $paidAmount = 0;
                }

                $newRefundedAmount = min($paidAmount, $refundedAmount + $amount);
                $order->refunded_amount = $newRefundedAmount;
                $order->status_refund = ($paidAmount > 0 && $newRefundedAmount + 0.0001 >= $paidAmount) ? 'full' : 'partial';
                $order->refunded_at = now();

                $orderMeta = is_array($order->meta) ? $order->meta : [];
                $orderMeta['marketplace_overdue_refund'] = [
                    'initiated_at' => now()->toIso8601String(),
                    'wallet_reference' => $walletReference,
                    'refund_reference' => $refundReference,
                    'reason' => 'seller_deadline_exceeded_24h',
                ];
                $order->meta = $orderMeta;
                $order->save();

                $partnerWallet = PartnerWallet::query()->where('seller_id', $mpOrder->seller_id)->lockForUpdate()->first();
                if ($partnerWallet) {
                    $reverseRef = 'marketplace_reverse_pending_refund_' . $mpOrder->id;
                    $existingReverse = PartnerWalletTransaction::query()->where('reference', $reverseRef)->lockForUpdate()->first();
                    if (!$existingReverse) {
                        $earnings = (float) ($mpOrder->seller_earnings ?? 0);
                        $pending = (float) ($partnerWallet->pending_balance ?? 0);
                        $toReverse = min(max(0.0, $earnings), max(0.0, $pending));

                        if ($toReverse > 0) {
                            $partnerWallet->pending_balance = max(0.0, $pending - $toReverse);
                            $partnerWallet->save();
                        }

                        PartnerWalletTransaction::query()->create([
                            'partner_wallet_id' => $partnerWallet->id,
                            'type' => 'debit_pending_refund',
                            'amount' => $toReverse,
                            'reference' => $reverseRef,
                            'meta' => [
                                'marketplace_order_id' => $mpOrder->id,
                                'order_id' => $mpOrder->order_id,
                                'reason' => 'auto_overdue_refund_24h',
                            ],
                            'status' => 'success',
                        ]);
                    }
                }

                $mpOrder->status = 'resolved_refund';
                $mpOrder->admin_issue_flag = true;
                $mpOrder->admin_issue_reason = 'Commande en retard: remboursement auto initié';
                $mpOrder->auto_refunded_at = $mpOrder->auto_refunded_at ?? now();
                $mpOrder->auto_refund_reference = $walletReference;
                $mpOrder->save();

                return true;
            });

            if ($done) {
                $processed++;
            } else {
                $skipped++;
            }
        }

        $this->info("Processed: {$processed} | Skipped: {$skipped}");

        return self::SUCCESS;
    }
}

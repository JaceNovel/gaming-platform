<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\GameAccount;
use App\Models\Refund;
use App\Mail\RefundIssued;
use App\Services\DeliveryService;
use App\Services\LoggedEmailService;
use App\Services\WalletService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessOrderDelivery implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public Order $order;

    /**
     * Create a new job instance.
     */
    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Execute the job.
     */
    public function handle(DeliveryService $deliveryService, WalletService $walletService, LoggedEmailService $loggedEmailService): void
    {
        try {
            // Marketplace gaming account orders have their own workflow (seller delivery proof + admin release).
            if ((string) ($this->order->type ?? '') === 'marketplace_gaming_account') {
                if (!$this->order->isPaymentSuccess()) {
                    return;
                }

                // Creates MarketplaceOrder, marks listing sold, and credits seller earnings to pending balance.
                ProcessMarketplaceOrder::dispatchSync($this->order);
                Log::info('Marketplace order processed', ['order_id' => $this->order->id]);
                return;
            }

            $this->order->loadMissing(['user', 'orderItems.product', 'orderItems.product.game']);

            // Process each order item
            $hasProcessing = false;
            $hasPhysical = false;
            $hasRefund = false;

            foreach ($this->order->orderItems as $orderItem) {
                $product = $orderItem->product;

                if ($product->type === 'account') {
                    $result = $this->deliverAccount($deliveryService, $walletService, $loggedEmailService, $orderItem);
                    if ($result === 'refunded') {
                        $hasRefund = true;
                    }
                } elseif (in_array($product->type, ['recharge', 'subscription', 'item', 'topup', 'pass'])) {
                    $this->deliverTopup($loggedEmailService, $orderItem);
                    $hasProcessing = true;
                } else {
                    $isPhysical = (bool) ($orderItem->is_physical ?? false) || (bool) ($product->shipping_required ?? false);
                    if ($isPhysical) {
                        $hasPhysical = true;
                    }
                    $this->deliverArticle($loggedEmailService, $orderItem, $isPhysical);
                }
            }

            $newDeliveryState = $hasProcessing ? 'processing' : ($hasPhysical ? 'shipping_pending' : 'delivered');
            if ($hasRefund) {
                $statuses = $this->order->orderItems->pluck('delivery_status')->map(fn ($v) => (string) $v);
                $allRefunded = $statuses->every(fn ($s) => $s === 'refunded');
                $newDeliveryState = $allRefunded ? 'refunded' : ($hasProcessing ? 'processing' : 'partially_refunded');
            }

            $orderMeta = $this->order->meta ?? [];
            if (!is_array($orderMeta)) {
                $orderMeta = [];
            }
            $orderMeta['delivery_state'] = $newDeliveryState;
            $orderMeta['delivery_processed_at'] = now()->toIso8601String();

            $payload = ['meta' => $orderMeta];
            if ($hasPhysical) {
                $payload['shipping_status'] = $this->order->shipping_status ?: 'pending';
            }
            if ($newDeliveryState === 'delivered' && empty($this->order->delivered_at)) {
                $payload['delivered_at'] = now();
            }

            $this->order->update($payload);

            Log::info('Order delivery processed', ['order_id' => $this->order->id]);

        } catch (\Exception $e) {
            Log::error('Order delivery failed', [
                'order_id' => $this->order->id,
                'error' => $e->getMessage()
            ]);

            // For marketplace gaming accounts, never swallow errors: payments must rollback (wallet)
            // and queued jobs must retry.
            if ((string) ($this->order->type ?? '') === 'marketplace_gaming_account') {
                throw $e;
            }

            // Could send admin notification here
        }
    }

    protected function deliverAccount(DeliveryService $deliveryService, WalletService $walletService, LoggedEmailService $loggedEmailService, $orderItem): string
    {
        // Find available account
        $account = GameAccount::where('game_id', $orderItem->product->game_id)
            ->where('is_sold', false)
            ->first();

        if (!$account) {
            $user = $this->order->user;
            $amount = (float) $orderItem->price * (int) $orderItem->quantity;
            $reference = 'REF-ORDERITEM-' . $orderItem->id;
            $reason = 'Produit account indisponible (rupture de stock)';

            $walletService->credit($user, $reference, $amount, [
                'type' => 'order_refund',
                'order_id' => $this->order->id,
                'order_item_id' => $orderItem->id,
                'product_id' => $orderItem->product_id,
                'reason' => $reason,
            ]);

            $refund = Refund::firstOrCreate(
                ['reference' => $reference],
                [
                    'order_id' => $this->order->id,
                    'user_id' => $user->id,
                    'amount' => $amount,
                    'reason' => $reason,
                    'status' => 'completed',
                ]
            );

            $orderItem->update([
                'delivery_status' => 'refunded',
                'delivery_payload' => [
                    'reason' => $reason,
                    'refund_reference' => $reference,
                    'refund_amount' => $amount,
                ],
            ]);

            $loggedEmailService->queue(
                userId: (int) $user->id,
                to: (string) $user->email,
                type: 'refund_issued',
                subject: 'Remboursement crédité sur votre wallet - PRIME Gaming',
                mailable: new RefundIssued($this->order, $refund),
                meta: ['order_id' => $this->order->id, 'order_item_id' => $orderItem->id]
            );

            return 'refunded';
        }

        // Mark as sold
        $account->update([
            'is_sold' => true,
            'sold_at' => now(),
        ]);

        // Send delivery email
        $deliveryPayload = [
            'account' => $account->account_details,
            'game' => $account->game->name ?? null,
        ];

        $orderItem->update([
            'delivery_status' => 'delivered',
            'delivery_payload' => $deliveryPayload,
        ]);

        $deliveryService->sendAccountDeliveryEmail($this->order, $account);

        return 'delivered';
    }

    protected function deliverTopup(LoggedEmailService $loggedEmailService, $orderItem)
    {
        // For top-ups, subscriptions, passes - store for admin validation
        // Admin will manually process these
        // For now, just mark as processing and send confirmation

        $orderItem->update([
            'delivery_status' => 'processing',
            'delivery_payload' => $orderItem->game_user_id,
        ]);

        $loggedEmailService->queue(
            userId: (int) $this->order->user_id,
            to: (string) ($this->order->user?->email ?? ''),
            type: 'topup_confirmation',
            subject: 'Paiement confirmé - Traitement',
            mailable: new \App\Mail\TopupConfirmation($this->order, $orderItem),
            meta: ['order_id' => $this->order->id, 'order_item_id' => $orderItem->id]
        );
    }

    protected function deliverArticle(LoggedEmailService $loggedEmailService, $orderItem, bool $isPhysical)
    {
        // For physical/digital articles - send confirmation
        $orderItem->update([
            'delivery_status' => $isPhysical ? 'shipping_pending' : 'delivered',
        ]);

        $loggedEmailService->queue(
            userId: (int) $this->order->user_id,
            to: (string) ($this->order->user?->email ?? ''),
            type: 'article_confirmation',
            subject: 'Commande confirmée - Livraison',
            mailable: new \App\Mail\ArticleConfirmation($this->order, $orderItem),
            meta: ['order_id' => $this->order->id, 'order_item_id' => $orderItem->id]
        );
    }
}

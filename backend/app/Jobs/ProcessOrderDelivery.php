<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\GameAccount;
use App\Models\EmailLog;
use App\Models\Refund;
use App\Mail\RefundIssued;
use App\Services\DeliveryService;
use App\Services\WalletService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ProcessOrderDelivery implements ShouldQueue
{
    use Queueable;

    protected $order;

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
    public function handle(DeliveryService $deliveryService, WalletService $walletService): void
    {
        try {
            $this->order->loadMissing(['user', 'orderItems.product', 'orderItems.product.game']);

            // Process each order item
            $hasProcessing = false;
            $hasPhysical = false;
            $hasRefund = false;

            foreach ($this->order->orderItems as $orderItem) {
                $product = $orderItem->product;

                if ($product->type === 'account') {
                    $result = $this->deliverAccount($deliveryService, $walletService, $orderItem);
                    if ($result === 'refunded') {
                        $hasRefund = true;
                    }
                } elseif (in_array($product->type, ['recharge', 'subscription', 'item', 'topup', 'pass'])) {
                    $this->deliverTopup($orderItem);
                    $hasProcessing = true;
                } else {
                    $isPhysical = (bool) ($orderItem->is_physical ?? false) || (bool) ($product->shipping_required ?? false);
                    if ($isPhysical) {
                        $hasPhysical = true;
                    }
                    $this->deliverArticle($orderItem, $isPhysical);
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

            // Could send admin notification here
        }
    }

    protected function deliverAccount(DeliveryService $deliveryService, WalletService $walletService, $orderItem): string
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

            Mail::to($user->email)->send(new RefundIssued($this->order, $refund));
            EmailLog::create([
                'user_id' => $user->id,
                'to' => $user->email,
                'type' => 'refund_issued',
                'subject' => 'Remboursement crédité sur votre wallet - BADBOYSHOP',
                'status' => 'sent',
                'sent_at' => now(),
            ]);

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

        // Log email
        EmailLog::create([
            'user_id' => $this->order->user_id,
            'to' => $this->order->user->email,
            'type' => 'account_delivery',
            'subject' => 'Vos identifiants de jeu BADBOYSHOP',
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        return 'delivered';
    }

    protected function deliverTopup($orderItem)
    {
        // For top-ups, subscriptions, passes - store for admin validation
        // Admin will manually process these
        // For now, just mark as processing and send confirmation

        $orderItem->update([
            'delivery_status' => 'processing',
            'delivery_payload' => $orderItem->game_user_id,
        ]);

        Mail::to($this->order->user->email)->send(new \App\Mail\TopupConfirmation($this->order, $orderItem));

        EmailLog::create([
            'user_id' => $this->order->user_id,
            'to' => $this->order->user->email,
            'type' => 'topup_confirmation',
            'subject' => 'Paiement confirmé - Traitement',
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }

    protected function deliverArticle($orderItem, bool $isPhysical)
    {
        // For physical/digital articles - send confirmation
        $orderItem->update([
            'delivery_status' => $isPhysical ? 'shipping_pending' : 'delivered',
        ]);

        Mail::to($this->order->user->email)->send(new \App\Mail\ArticleConfirmation($this->order, $orderItem));

        EmailLog::create([
            'user_id' => $this->order->user_id,
            'to' => $this->order->user->email,
            'type' => 'article_confirmation',
            'subject' => 'Commande confirmée - Livraison',
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }
}

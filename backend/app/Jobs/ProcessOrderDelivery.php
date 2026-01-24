<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\GameAccount;
use App\Models\EmailLog;
use App\Services\DeliveryService;
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
    public function handle(DeliveryService $deliveryService): void
    {
        try {
            // Process each order item
            $hasProcessing = false;

            foreach ($this->order->orderItems as $orderItem) {
                $product = $orderItem->product;

                if ($product->type === 'account') {
                    $this->deliverAccount($deliveryService, $orderItem);
                } elseif (in_array($product->type, ['recharge', 'subscription', 'item', 'topup', 'pass'])) {
                    $this->deliverTopup($orderItem);
                    $hasProcessing = true;
                } else {
                    $this->deliverArticle($orderItem);
                }
            }

            $this->order->update([
                'status' => $hasProcessing ? 'processing' : 'delivered',
            ]);

            Log::info('Order delivery processed', ['order_id' => $this->order->id]);

        } catch (\Exception $e) {
            Log::error('Order delivery failed', [
                'order_id' => $this->order->id,
                'error' => $e->getMessage()
            ]);

            // Could send admin notification here
        }
    }

    protected function deliverAccount(DeliveryService $deliveryService, $orderItem)
    {
        // Find available account
        $account = GameAccount::where('game_id', $orderItem->product->game_id)
            ->where('is_sold', false)
            ->first();

        if (!$account) {
            throw new \Exception('No available accounts for delivery');
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
            'subject' => 'Paiement confirmé - Traitement en cours',
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }

    protected function deliverArticle($orderItem)
    {
        // For physical/digital articles - send confirmation
        $orderItem->update([
            'delivery_status' => 'delivered',
        ]);

        Mail::to($this->order->user->email)->send(new \App\Mail\ArticleConfirmation($this->order, $orderItem));

        EmailLog::create([
            'user_id' => $this->order->user_id,
            'to' => $this->order->user->email,
            'type' => 'article_confirmation',
            'subject' => 'Commande confirmée - Livraison en cours',
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }
}

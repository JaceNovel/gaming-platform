<?php

namespace App\Jobs;

use App\Exceptions\RedeemStockDepletedException;
use App\Mail\RedeemCodeDelivery;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\RedeemCode;
use App\Services\RedeemCodeAllocator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ProcessRedeemFulfillment implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $orderId)
    {
        $this->onQueue('redeem-fulfillment');
    }

    public function handle(RedeemCodeAllocator $allocator): void
    {
        $order = Order::with(['user', 'orderItems.redeemDenomination'])
            ->find($this->orderId);

        if (!$order || !$order->requiresRedeemFulfillment()) {
            return;
        }

        $assignedCodes = [];

        foreach ($order->orderItems as $orderItem) {
            if (!$orderItem->redeem_denomination_id || !$orderItem->redeemDenomination) {
                continue;
            }

            try {
                $code = $allocator->assignCode($orderItem->redeemDenomination, $order, $orderItem);
                $assignedCodes[] = $code;
            } catch (RedeemStockDepletedException $e) {
                Log::warning('Redeem stock depleted during fulfillment', [
                    'order_id' => $order->id,
                    'order_item_id' => $orderItem->id,
                    'denomination_id' => $orderItem->redeem_denomination_id,
                ]);

                $order->update(['status' => 'paid_pending_stock']);

                return;
            }
        }

        if (empty($assignedCodes)) {
            return;
        }

        $order->update([
            'status' => 'fulfilled',
        ]);

        Mail::to($order->user->email)->queue(new RedeemCodeDelivery($order, $assignedCodes));

        $codeIds = collect($assignedCodes)->pluck('id')->all();
        if (!empty($codeIds)) {
            RedeemCode::whereIn('id', $codeIds)->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);
        }

        EmailLog::create([
            'user_id' => $order->user_id,
            'to' => $order->user->email,
            'type' => 'redeem_code_delivery',
            'subject' => 'Votre code de recharge BADBOYSHOP',
            'status' => 'queued',
            'sent_at' => now(),
        ]);

        Log::info('Redeem fulfillment completed', [
            'order_id' => $order->id,
            'codes_sent' => count($assignedCodes),
        ]);
    }
}

<?php

namespace App\Jobs;

use App\Exceptions\RedeemStockDepletedException;
use App\Mail\RedeemCodeDelivery;
use App\Mail\OutOfStockMail;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\RedeemCode;
use App\Models\RedeemCodeDelivery;
use App\Services\RedeemCodeAllocator;
use App\Services\RedeemStockAlertService;
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

    public function handle(RedeemCodeAllocator $allocator, RedeemStockAlertService $alertService): void
    {
        $order = Order::with(['user', 'orderItems.redeemDenomination', 'orderItems.redeemCode'])
            ->find($this->orderId);

        if (!$order || !$order->requiresRedeemFulfillment()) {
            return;
        }

        if (RedeemCodeDelivery::where('order_id', $order->id)->exists()) {
            return;
        }

        $assignedCodes = [];

        foreach ($order->orderItems as $orderItem) {
            if (!$orderItem->redeem_denomination_id || !$orderItem->redeemDenomination) {
                continue;
            }

            if ($orderItem->redeem_code_id) {
                continue;
            }

            try {
                $quantity = max(1, (int) ($orderItem->quantity ?? 1));
                $codes = $allocator->assignCodes($orderItem->redeemDenomination, $order, $orderItem, $quantity);
                $assignedCodes = array_merge($assignedCodes, $codes);
                $alertService->notifyIfLowStock($orderItem->redeemDenomination);
            } catch (RedeemStockDepletedException $e) {
                Log::warning('Redeem stock depleted during fulfillment', [
                    'order_id' => $order->id,
                    'order_item_id' => $orderItem->id,
                    'denomination_id' => $orderItem->redeem_denomination_id,
                ]);

                $order->update(['status' => 'paid_but_out_of_stock']);

                Mail::to($order->user->email)->queue(new OutOfStockMail($order));

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

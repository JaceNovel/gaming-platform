<?php

namespace App\Jobs;

use App\Exceptions\RedeemStockDepletedException;
use App\Mail\RedeemCodeDelivery as RedeemCodeDeliveryMail;
use App\Mail\OutOfStockMail;
use App\Models\Order;
use App\Models\RedeemCode;
use App\Models\RedeemCodeDelivery;
use App\Models\RedeemDenomination;
use App\Services\RedeemCodeAllocator;
use App\Services\RedeemStockAlertService;
use App\Services\NotificationService;
use App\Support\FrontendUrls;
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

    public function handle(RedeemCodeAllocator $allocator, RedeemStockAlertService $alertService, NotificationService $notificationService): void
    {
        $order = Order::with(['user', 'orderItems.redeemDenomination', 'orderItems.redeemCode', 'orderItems.product'])
            ->find($this->orderId);

        if (!$order) {
            return;
        }

        $this->attachRedeemDenominationsIfMissing($order);
        $order->refresh();
        $order->loadMissing(['orderItems.redeemDenomination', 'orderItems.redeemCode', 'orderItems.product', 'user']);

        if (!$order->requiresRedeemFulfillment()) {
            return;
        }

        $existingDeliveries = RedeemCodeDelivery::with(['redeemCode.denomination'])
            ->where('order_id', $order->id)
            ->orderBy('id')
            ->get();

        $assignedCodes = [];

        foreach ($order->orderItems as $orderItem) {
            if (!$orderItem->redeem_denomination_id || !$orderItem->redeemDenomination) {
                continue;
            }

            $quantity = max(1, (int) ($orderItem->quantity ?? 1));

            $existingForItem = $existingDeliveries
                ->filter(fn ($d) => (int) ($d->product_id ?? 0) === (int) ($orderItem->product_id ?? 0))
                ->filter(fn ($d) => (int) ($d->redeemCode?->denomination_id ?? 0) === (int) $orderItem->redeem_denomination_id)
                ->count();

            $missing = max(0, $quantity - $existingForItem);
            if ($missing <= 0) {
                continue;
            }

            try {
                $codes = $allocator->assignCodes($orderItem->redeemDenomination, $order, $orderItem, $missing);
                $assignedCodes = array_merge($assignedCodes, $codes);
                $alertService->notifyIfLowStock($orderItem->redeemDenomination);
            } catch (RedeemStockDepletedException $e) {
                Log::warning('Redeem stock depleted during fulfillment', [
                    'order_id' => $order->id,
                    'order_item_id' => $orderItem->id,
                    'denomination_id' => $orderItem->redeem_denomination_id,
                ]);

                $isPreorder = strtolower((string) ($orderItem->delivery_type ?? '')) === 'preorder'
                    || strtoupper((string) ($orderItem->product?->stock_type ?? '')) === 'PREORDER'
                    || strtolower((string) ($orderItem->product?->delivery_type ?? '')) === 'preorder';

                $orderMeta = $order->meta ?? [];
                if (!is_array($orderMeta)) {
                    $orderMeta = [];
                }
                $orderMeta['fulfillment_status'] = $isPreorder ? 'waiting_stock' : 'out_of_stock';
                $orderMeta['fulfillment_status_set_at'] = now()->toIso8601String();
                $order->update(['meta' => $orderMeta]);

                Mail::to($order->user->email)->queue(new OutOfStockMail($order));

                return;
            }
        }

        $allCodes = collect($existingDeliveries)
            ->map(fn ($d) => $d->redeemCode)
            ->filter()
            ->values()
            ->all();

        if (!empty($assignedCodes)) {
            $allCodes = array_merge($allCodes, $assignedCodes);
        }

        if (empty($allCodes)) {
            return;
        }

        $orderMeta = $order->meta ?? [];
        if (!is_array($orderMeta)) {
            $orderMeta = [];
        }
        $orderMeta['fulfillment_status'] = $order->hasPhysicalItems() ? 'shipping_pending' : 'fulfilled';
        $orderMeta['fulfillment_completed_at'] = now()->toIso8601String();
        $order->update(['meta' => $orderMeta]);

        $codesText = collect($allCodes)
            ->map(fn ($code) => $code->code)
            ->filter()
            ->values()
            ->implode("\n");
        $guideUrl = FrontendUrls::guidePdfUrl();
        $message = "Codes recharge {$order->reference}:\n{$codesText}\nGuide PDF: {$guideUrl}";

        if (empty($orderMeta['redeem_notification_sent_at'])) {
            $notificationService->notifyUser($order->user_id, 'redeem_code', $message);
            $orderMeta['redeem_notification_sent_at'] = now()->toIso8601String();
        }

        if (empty($orderMeta['redeem_email_sent_at'])) {
            Mail::to($order->user->email)->queue(new RedeemCodeDeliveryMail($order->loadMissing('user'), $allCodes));
            $orderMeta['redeem_email_sent_at'] = now()->toIso8601String();
        }

        $order->update(['meta' => $orderMeta]);

        $codeIds = collect($allCodes)->pluck('id')->all();
        if (!empty($codeIds)) {
            RedeemCode::whereIn('id', $codeIds)->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);
        }

        Log::info('Redeem fulfillment completed', [
            'order_id' => $order->id,
            'codes_sent' => count($assignedCodes),
        ]);
    }

    private function attachRedeemDenominationsIfMissing(Order $order): bool
    {
        $order->loadMissing(['orderItems.product']);

        $updated = false;

        foreach ($order->orderItems as $orderItem) {
            if (!empty($orderItem->redeem_denomination_id)) {
                continue;
            }

            $product = $orderItem->product;
            if (!$product) {
                continue;
            }

            $requiresDenomination = ($product->stock_mode ?? 'manual') === 'redeem_pool'
                || (bool) ($product->redeem_code_delivery ?? false)
                || strtolower((string) ($product->type ?? '')) === 'redeem';

            if (!$requiresDenomination) {
                continue;
            }

            $quantity = max(1, (int) ($orderItem->quantity ?? 1));

            $denominations = RedeemDenomination::query()
                ->where('active', true)
                ->where(function ($q) use ($product) {
                    $q->where('product_id', $product->id)->orWhereNull('product_id');
                })
                ->orderByRaw('CASE WHEN product_id IS NULL THEN 1 ELSE 0 END')
                ->orderByDesc('diamonds')
                ->get();

            foreach ($denominations as $denomination) {
                $available = RedeemCode::where('denomination_id', $denomination->id)
                    ->where('status', 'available')
                    ->count();

                if ($available >= $quantity) {
                    $orderItem->update(['redeem_denomination_id' => $denomination->id]);
                    $updated = true;
                    break;
                }
            }
        }

        return $updated;
    }
}

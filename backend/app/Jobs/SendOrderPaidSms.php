<?php

namespace App\Jobs;

use App\Models\Order;
use App\Services\NghSmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendOrderPaidSms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $orderId)
    {
    }

    public function handle(NghSmsService $sms): void
    {
        if (!(bool) config('ngh_sms.enabled', false)) {
            return;
        }

        if (!$sms->isConfigured()) {
            Log::warning('ngh_sms:not_configured');
            return;
        }

        $order = Order::query()->with('user')->find($this->orderId);
        if (!$order) {
            return;
        }

        if (!$order->isPaymentSuccess()) {
            return;
        }

        if ((string) ($order->type ?? '') === 'wallet_topup') {
            return;
        }

        $meta = $order->meta ?? [];
        if (!is_array($meta)) {
            $meta = [];
        }

        $to = trim((string) (
            $meta['customer_phone']
                ?? $meta['phone']
                ?? ($order->shipping_phone ?? '')
        ));
        if ($to === '') {
            return;
        }

        $smsMeta = $meta['sms'] ?? [];
        if (!is_array($smsMeta)) {
            $smsMeta = [];
        }

        if (!empty($smsMeta['order_paid_sent_at'])) {
            return;
        }

        $reference = (string) ($order->reference ?: ('ORDER-' . $order->id));
        $text = "PRIME Gaming: Paiement confirme pour votre commande {$reference}. Merci.";

        $clientReference = 'order_paid_' . $order->id;
        $resp = $sms->sendSingle(
            to: $to,
            text: $text,
            reference: $clientReference,
        );

        $smsMeta['order_paid_sent_at'] = now()->toIso8601String();
        $smsMeta['order_paid_reference'] = $clientReference;
        $smsMeta['order_paid_response'] = [
            'success' => $resp['success'] ?? null,
            'message' => $resp['message'] ?? null,
            'status' => $resp['status'] ?? null,
        ];

        $meta['sms'] = $smsMeta;
        $order->update(['meta' => $meta]);
    }
}

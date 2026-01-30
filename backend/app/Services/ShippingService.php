<?php

namespace App\Services;

use App\Models\Order;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\Storage;

class ShippingService
{
    public function computeShippingForOrder(Order $order): Order
    {
        $order->loadMissing(['orderItems.product']);

        $physicalItems = $order->orderItems->filter(function ($item) {
            if ($item->is_physical !== null) {
                return (bool) $item->is_physical;
            }

            return (bool) ($item->product?->shipping_required ?? false);
        });

        if ($physicalItems->isEmpty()) {
            $order->update([
                'shipping_eta_days' => null,
                'shipping_estimated_date' => null,
            ]);
            return $order->refresh();
        }

        $maxEta = 0;
        foreach ($physicalItems as $item) {
            $eta = $item->delivery_eta_days ?? $item->product?->delivery_eta_days ?? 0;
            if ($eta > $maxEta) {
                $maxEta = $eta;
            }
        }

        $order->update([
            'shipping_eta_days' => $maxEta > 0 ? $maxEta : null,
            'shipping_estimated_date' => $maxEta > 0 ? now()->addDays($maxEta) : null,
            'shipping_status' => $order->shipping_status ?: 'pending',
        ]);

        return $order->refresh();
    }

    public function generateDeliveryNotePdf(Order $order): array
    {
        $order->loadMissing(['user', 'orderItems.product']);

        if (!$order->hasPhysicalItems()) {
            throw new \RuntimeException('Order has no physical items');
        }

        if (!$order->isPaymentSuccess()) {
            throw new \RuntimeException('Order not paid');
        }

        $physicalItems = $order->orderItems->filter(function ($item) {
            return (bool) ($item->is_physical ?? false) || (bool) ($item->product?->shipping_required ?? false);
        })->values();

        $signatureUrl = env('BADBOYSHOP_SIGNATURE_URL');
        $logoUrl = env('BADBOYSHOP_LOGO_URL');

        $html = view('shipping-delivery-note', [
            'order' => $order,
            'items' => $physicalItems,
            'signature_url' => $signatureUrl,
            'logo_url' => $logoUrl,
        ])->render();

        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4');
        $dompdf->render();

        $userId = $order->user_id ?? $order->user?->id;
        $folder = $userId ? ('delivery-notes/user-' . $userId) : 'delivery-notes/unknown-user';
        $path = $folder . '/order-' . $order->id . '.pdf';
        Storage::disk('public')->put($path, $dompdf->output());

        $order->update([
            'shipping_document_path' => $path,
        ]);

        return [
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
        ];
    }
}

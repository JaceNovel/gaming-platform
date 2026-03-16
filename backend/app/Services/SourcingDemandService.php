<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProcurementDemand;
use App\Models\ProductSupplierLink;
use Carbon\CarbonInterface;

class SourcingDemandService
{
    public function syncForPaidOrder(Order $order): array
    {
        $order->loadMissing(['orderItems.product.productSupplierLinks.supplierProductSku.supplierProduct.supplierAccount']);

        $createdOrUpdated = [];

        foreach ($order->orderItems as $orderItem) {
            if (!$this->requiresSourcing($orderItem)) {
                continue;
            }

            $product = $orderItem->product;
            if (!$product) {
                continue;
            }

            $quantityRequested = max(1, (int) ($orderItem->quantity ?? 1));
            $committedBefore = (int) OrderItem::query()
                ->where('product_id', $product->id)
                ->whereKeyNot($orderItem->id)
                ->whereHas('order', function ($query) {
                    $query->where('status', Order::STATUS_PAYMENT_SUCCESS);
                })
                ->where(function ($query) {
                    $query->whereNull('delivery_status')
                        ->orWhereNotIn('delivery_status', ['refunded', 'cancelled']);
                })
                ->sum('quantity');

            $availableBefore = max(0, (int) ($product->stock ?? 0) - $committedBefore);
            $quantityAllocatedFromStock = min($quantityRequested, $availableBefore);
            $quantityToProcure = max(0, $quantityRequested - $quantityAllocatedFromStock);

            $defaultLink = $this->resolveDefaultLink($product->productSupplierLinks->all());

            if ($quantityToProcure <= 0) {
                ProcurementDemand::query()->where('order_item_id', $orderItem->id)->delete();
                continue;
            }

            $demand = ProcurementDemand::updateOrCreate(
                [
                    'order_item_id' => $orderItem->id,
                ],
                [
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_supplier_link_id' => $defaultLink?->id,
                    'supplier_product_sku_id' => $defaultLink?->supplier_product_sku_id,
                    'quantity_requested' => $quantityRequested,
                    'quantity_allocated_from_stock' => $quantityAllocatedFromStock,
                    'quantity_to_procure' => $quantityToProcure,
                    'status' => 'pending',
                    'trigger_reason' => ((string) ($orderItem->delivery_type ?? '')) === 'preorder' ? 'preorder' : 'stock_gap',
                    'needed_by_date' => $this->resolveNeededByDate($orderItem),
                    'batch_locked_at' => null,
                ]
            );

            $createdOrUpdated[] = $demand->id;
        }

        return $createdOrUpdated;
    }

    private function requiresSourcing(OrderItem $orderItem): bool
    {
        $product = $orderItem->product;
        if (!$product) {
            return false;
        }

        $isPhysical = (bool) ($orderItem->is_physical ?? false) || (bool) ($product->shipping_required ?? false);
        if (!$isPhysical) {
            return false;
        }

        return (string) ($product->type ?? '') === 'item';
    }

    private function resolveDefaultLink(array $links): ?ProductSupplierLink
    {
        if (empty($links)) {
            return null;
        }

        usort($links, function (ProductSupplierLink $left, ProductSupplierLink $right) {
            if ($left->is_default !== $right->is_default) {
                return $left->is_default ? -1 : 1;
            }

            return (int) ($left->priority ?? 1) <=> (int) ($right->priority ?? 1);
        });

        return $links[0] ?? null;
    }

    private function resolveNeededByDate(OrderItem $orderItem): ?CarbonInterface
    {
        $etaDays = (int) ($orderItem->delivery_eta_days ?? $orderItem->product?->delivery_eta_days ?? 0);
        return $etaDays > 0 ? now()->addDays($etaDays) : null;
    }
}
<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProcurementDemand;
use App\Models\ProductSupplierLink;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class SourcingDemandService
{
    public function __construct(
        private AliExpressTransitPricingService $transitPricing,
        private ProcurementBatchService $procurementBatchService,
        private GroupedLotService $groupedLotService,
    )
    {
    }

    public function syncForPaidOrder(Order $order): array
    {
        $order->loadMissing(['orderItems.product.productSupplierLinks.supplierProductSku.supplierProduct.supplierAccount']);

        $createdOrUpdated = [];
        $groupingProductIds = [];
        $countryCode = '';

        DB::transaction(function () use ($order, &$groupingProductIds, &$countryCode) {
            $meta = $order->meta ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }

            if (empty($meta['grouping_registered_at'])) {
                $countryCode = (string) ($order->supplier_country_code ?: $meta['destination_country_code'] ?? '');
                if ($countryCode !== '') {
                    $this->transitPricing->assignOrderTransit($order, $countryCode);
                    $countryCode = (string) ($order->fresh()?->supplier_country_code ?: $countryCode);
                }

                if ($countryCode !== '' && $this->transitPricing->isDirectDeliveryCountry($countryCode)) {
                    $meta['grouping_registered_at'] = now()->toIso8601String();
                    $order->update(['meta' => $meta]);
                    return;
                }

                foreach ($order->orderItems as $item) {
                    if ($this->requiresSourcing($item) && $item->product_id) {
                        $item->product()->increment('grouping_current_count', max(1, (int) ($item->quantity ?? 1)));
                        $groupingProductIds[] = (int) $item->product_id;
                        $this->releaseGroupingIfReady($item->product_id, (string) $order->supplier_country_code);
                    }
                }

                $meta['grouping_registered_at'] = now()->toIso8601String();
                $order->update(['meta' => $meta]);
            }
        });

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

        if ($countryCode !== '' && $groupingProductIds !== []) {
            $this->procurementBatchService->autoCreateReadyDraftBatches(
                array_values(array_unique(array_filter($groupingProductIds))),
                $countryCode,
            );
        }

        return $createdOrUpdated;
    }

    private function releaseGroupingIfReady(int $productId, string $countryCode): void
    {
        if ($countryCode === '') {
            return;
        }

        $product = OrderItem::query()
            ->with('product.productSupplierLinks.supplierProductSku')
            ->where('product_id', $productId)
            ->latest('id')
            ->first()?->product;

        if (!$product) {
            return;
        }

        $metrics = $this->groupedLotService->currentOpenLotMetrics($product, $countryCode);
        if (empty($metrics['is_ready'])) {
            return;
        }

        Order::query()
            ->where('status', Order::STATUS_PAYMENT_SUCCESS)
            ->where('supplier_country_code', $countryCode)
            ->where('supplier_fulfillment_status', Order::SUPPLIER_STATUS_GROUPING)
            ->whereNull('grouping_released_at')
            ->whereHas('orderItems', function ($query) use ($productId) {
                $query->where('product_id', $productId);
            })
            ->update([
                'supplier_fulfillment_status' => Order::SUPPLIER_STATUS_PENDING,
                'grouping_released_at' => now(),
            ]);
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
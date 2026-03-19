<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductSupplierLink;

class GroupedLotService
{
    public const DEFAULT_BASE_MOQ = 1;
    public const MOQ_BATCH_MULTIPLIER = 10;
    public const MINIMUM_LOT_AMOUNT_XOF = 25000.0;
    public const FALLBACK_SHIPPING_FEE_XOF = 2500.0;

    public function resolveDefaultLink(Product $product): ?ProductSupplierLink
    {
        if (!$product->relationLoaded('productSupplierLinks') && !$product->getKey()) {
            return null;
        }

        $links = $product->relationLoaded('productSupplierLinks')
            ? $product->productSupplierLinks->all()
            : $product->productSupplierLinks()->with('supplierProductSku')->get()->all();

        if ($links === []) {
            return null;
        }

        usort($links, static function (ProductSupplierLink $left, ProductSupplierLink $right): int {
            if ($left->is_default !== $right->is_default) {
                return $left->is_default ? -1 : 1;
            }

            return (int) ($left->priority ?? 1) <=> (int) ($right->priority ?? 1);
        });

        return $links[0] ?? null;
    }

    public function resolveBaseMoq(Product $product, ?ProductSupplierLink $link = null): int
    {
        $link ??= $this->resolveDefaultLink($product);

        return max(1, (int) ($link?->target_moq ?? $link?->supplierProductSku?->moq ?? self::DEFAULT_BASE_MOQ));
    }

    public function resolveEffectiveGroupingQuantity(Product $product, ?ProductSupplierLink $link = null): int
    {
        return $this->resolveBaseMoq($product, $link) * self::MOQ_BATCH_MULTIPLIER;
    }

    public function currentOpenLotMetrics(Product $product, string $countryCode, ?ProductSupplierLink $link = null): array
    {
        $link ??= $this->resolveDefaultLink($product);
        $requiredQuantity = $this->resolveEffectiveGroupingQuantity($product, $link);

        $aggregates = OrderItem::query()
            ->selectRaw('COALESCE(SUM(quantity), 0) as total_quantity')
            ->selectRaw('COALESCE(SUM(quantity * price), 0) as total_amount')
            ->where('product_id', $product->id)
            ->whereHas('order', function ($query) use ($countryCode) {
                $query->where('status', Order::STATUS_PAYMENT_SUCCESS)
                    ->where('supplier_country_code', strtoupper(trim($countryCode)))
                    ->where('supplier_fulfillment_status', Order::SUPPLIER_STATUS_GROUPING)
                    ->whereNull('grouping_released_at');
            })
            ->first();

        $currentQuantity = max(0, (int) ($aggregates?->total_quantity ?? 0));
        $currentAmount = max(0.0, round((float) ($aggregates?->total_amount ?? 0), 2));

        return $this->buildMetrics($requiredQuantity, $currentQuantity, $currentAmount);
    }

    public function projectMetrics(array $currentMetrics, int $quantityToAdd, float $amountToAdd): array
    {
        return $this->buildMetrics(
            (int) ($currentMetrics['required_quantity'] ?? self::MOQ_BATCH_MULTIPLIER),
            max(0, (int) ($currentMetrics['current_quantity'] ?? 0) + max(0, $quantityToAdd)),
            max(0.0, (float) ($currentMetrics['current_amount'] ?? 0) + max(0.0, $amountToAdd)),
        );
    }

    public function resolveShippingFee(array $projectedMetrics): float
    {
        return !empty($projectedMetrics['is_ready']) ? 0.0 : self::FALLBACK_SHIPPING_FEE_XOF;
    }

    private function buildMetrics(int $requiredQuantity, int $currentQuantity, float $currentAmount): array
    {
        $requiredQuantity = max(1, $requiredQuantity);
        $currentQuantity = max(0, $currentQuantity);
        $currentAmount = max(0.0, round($currentAmount, 2));
        $minimumAmount = self::MINIMUM_LOT_AMOUNT_XOF;

        return [
            'required_quantity' => $requiredQuantity,
            'current_quantity' => $currentQuantity,
            'current_amount' => $currentAmount,
            'minimum_amount' => $minimumAmount,
            'remaining_quantity' => max(0, $requiredQuantity - $currentQuantity),
            'remaining_amount' => max(0.0, round($minimumAmount - $currentAmount, 2)),
            'is_ready' => $currentQuantity >= $requiredQuantity && $currentAmount >= $minimumAmount,
            'progress_label' => $currentQuantity . '/' . $requiredQuantity,
        ];
    }
}
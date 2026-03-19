<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\SupplierCountry;
use App\Models\SupplierReceivingAddress;
use Illuminate\Support\Arr;

class AliExpressTransitPricingService
{
    public const DEFAULT_MARGIN_PERCENT = 17.0;
    public const DIRECT_DELIVERY_COUNTRIES = [];

    public function usesTransitPricing(Product $product): bool
    {
        return strtolower(trim((string) ($product->type ?? ''))) === 'item'
            && strtolower(trim((string) ($product->category ?? ''))) === 'accessory'
            && strtolower(trim((string) ($product->preferred_supplier_platform ?? ''))) === 'aliexpress';
    }

    public function storefrontCountries(): array
    {
        return SupplierCountry::query()
            ->where('platform', 'aliexpress')
            ->where('is_active', true)
            ->where('storefront_enabled', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(function (SupplierCountry $country) {
                return [
                    'id' => $country->id,
                    'code' => $country->code,
                    'name' => $country->name,
                    'currency_code' => $country->currency_code,
                    'transit_provider_name' => $country->transit_provider_name,
                    'transit_city' => $country->transit_city,
                    'customer_notice' => $country->customer_notice,
                    'pricing_rules' => $country->pricing_rules_json,
                ];
            })
            ->all();
    }

    public function resolveCountry(string $countryCode): SupplierCountry
    {
        return SupplierCountry::query()
            ->where('platform', 'aliexpress')
            ->where('code', strtoupper(trim($countryCode)))
            ->where('is_active', true)
            ->where('storefront_enabled', true)
            ->firstOrFail();
    }

    public function defaultReceivingAddress(SupplierCountry $country): ?SupplierReceivingAddress
    {
        return SupplierReceivingAddress::query()
            ->where('platform', 'aliexpress')
            ->where('supplier_country_id', $country->id)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->first();
    }

    public function enrichProduct(Product $product, string $countryCode): array
    {
        if (!$this->usesTransitPricing($product)) {
            return $product->toArray();
        }

        $country = $this->resolveCountry($countryCode);
        $pricing = $this->computeProductPricing($product, $country);
        $isDirectDelivery = $this->isDirectDeliveryCountry($country);

        return array_merge($product->toArray(), [
            'storefront_country_code' => $country->code,
            'storefront_country_name' => $country->name,
            'transit_provider_name' => $country->transit_provider_name,
            'transit_city' => $country->transit_city,
            'customer_notice' => $country->customer_notice,
            'direct_delivery' => $isDirectDelivery,
            'computed_transport_unit_fee' => $pricing['transport_unit_fee'],
            'computed_final_price' => $pricing['final_price'],
            'computed_price_breakdown' => $pricing,
        ]);
    }

    public function computeProductPricing(Product $product, SupplierCountry $country, int $quantity = 1): array
    {
        if (!$this->usesTransitPricing($product)) {
            $sourcePrice = $this->resolveSourcePrice($product);

            return [
                'country_code' => $country->code,
                'country_name' => $country->name,
                'source_price' => round($sourcePrice, 2),
                'weight_grams' => 0,
                'estimated_cbm' => 0.0,
                'logistics_profile' => null,
                'grouping_threshold' => 1,
                'grouping_progress' => 0,
                'transport_mode' => null,
                'transport_total_fee' => 0.0,
                'transport_unit_fee' => 0.0,
                'margin_percent' => 0.0,
                'final_price' => round($sourcePrice, 2),
                'currency_code' => $country->currency_code ?: 'XOF',
                'customer_notice' => null,
                'transit_provider_name' => null,
                'transit_city' => null,
                'direct_delivery' => false,
            ];
        }

        $weightGrams = max(0, (int) ($product->estimated_weight_grams ?? Arr::get($product->details ?? [], 'estimated_weight_grams', 0)));
        $cbm = (float) ($product->estimated_cbm ?? Arr::get($product->details ?? [], 'estimated_cbm', 0));
        $profile = strtolower((string) ($product->source_logistics_profile ?? Arr::get($product->details ?? [], 'source_logistics_profile', 'ordinary')));
        $sourcePrice = $this->resolveSourcePrice($product);
        $minimumGrouping = max(1, (int) ($product->grouping_threshold ?: 1));
        $marginPercent = $this->resolveMarginPercent($product);

        $transport = $this->computeTransportFee($country, $weightGrams, $cbm, $profile, $quantity, $minimumGrouping);
        $base = $sourcePrice + $transport['per_unit_fee'];
        $final = $base + ($base * ($marginPercent / 100));

        return [
            'country_code' => $country->code,
            'country_name' => $country->name,
            'source_price' => round($sourcePrice, 2),
            'weight_grams' => $weightGrams,
            'estimated_cbm' => round($cbm, 4),
            'logistics_profile' => $profile,
            'grouping_threshold' => $minimumGrouping,
            'grouping_progress' => (int) ($product->grouping_current_count ?? 0),
            'transport_mode' => $transport['mode'],
            'transport_total_fee' => round($transport['total_fee'], 2),
            'transport_unit_fee' => round($transport['per_unit_fee'], 2),
            'margin_percent' => round($marginPercent, 2),
            'final_price' => round($final, 2),
            'currency_code' => $country->currency_code ?: 'XOF',
            'customer_notice' => $country->customer_notice,
            'transit_provider_name' => $country->transit_provider_name,
            'transit_city' => $country->transit_city,
            'direct_delivery' => $this->isDirectDeliveryCountry($country),
        ];
    }

    public function assignOrderTransit(Order $order, string $countryCode): array
    {
        $country = $this->resolveCountry($countryCode);
        $isDirectDelivery = $this->isDirectDeliveryCountry($country);
        $address = $isDirectDelivery ? null : $this->defaultReceivingAddress($country);

        $snapshot = [
            'country_code' => $country->code,
            'country_name' => $country->name,
            'transit_provider_name' => $country->transit_provider_name,
            'transit_city' => $country->transit_city,
            'customer_notice' => $country->customer_notice,
            'direct_delivery' => $isDirectDelivery,
        ];

        $order->update([
            'supplier_platform' => 'aliexpress',
            'supplier_country_code' => $country->code,
            'supplier_receiving_address_id' => $address?->id,
            'supplier_fulfillment_status' => $isDirectDelivery ? Order::SUPPLIER_STATUS_PENDING : Order::SUPPLIER_STATUS_GROUPING,
            'transit_pricing_snapshot_json' => $snapshot,
        ]);

        return ['country' => $country, 'address' => $address, 'snapshot' => $snapshot];
    }

    public function isDirectDeliveryCountry(SupplierCountry|string $country): bool
    {
        $code = $country instanceof SupplierCountry ? $country->code : strtoupper(trim((string) $country));

        return in_array($code, self::DIRECT_DELIVERY_COUNTRIES, true);
    }

    private function resolveSourcePrice(Product $product): float
    {
        $details = is_array($product->details) ? $product->details : [];
        $price = (float) ($details['source_price_fcfa'] ?? $product->discount_price ?: $product->price ?: $product->price_fcfa ?: 0);
        return max(0, $price);
    }

    private function resolveMarginPercent(Product $product): float
    {
        if (!$this->usesTransitPricing($product)) {
            return 0.0;
        }

        return (float) ($product->supplier_margin_value ?: self::DEFAULT_MARGIN_PERCENT);
    }

    private function computeTransportFee(SupplierCountry $country, int $weightGrams, float $cbm, string $profile, int $quantity, int $groupingThreshold): array
    {
        if ($this->isDirectDeliveryCountry($country)) {
            return [
                'mode' => 'direct',
                'total_fee' => 0.0,
                'per_unit_fee' => 0.0,
            ];
        }

        $rules = (array) ($country->pricing_rules_json ?? []);
        $weightKg = $weightGrams > 0 ? $weightGrams / 1000 : 0.0;
        $effectiveWeight = max($weightKg * max(1, $quantity), 0.001);
        $effectiveCbm = max($cbm * max(1, $quantity), 0.0001);

        $airFee = $this->computeAirFee((array) ($rules['air'] ?? []), $effectiveWeight, $profile);
        $seaFee = $this->computeSeaFee((array) ($rules['sea'] ?? []), $effectiveWeight, $effectiveCbm);

        $mode = $seaFee !== null && $airFee !== null ? ($seaFee < $airFee ? 'sea' : 'air') : ($seaFee !== null ? 'sea' : 'air');
        $totalFee = $mode === 'sea' && $seaFee !== null ? $seaFee : ($airFee ?? 0.0);
        $divisor = max(1, $groupingThreshold);

        return [
            'mode' => $mode,
            'total_fee' => $totalFee,
            'per_unit_fee' => $totalFee / $divisor,
        ];
    }

    private function computeAirFee(array $rules, float $weightKg, string $profile): ?float
    {
        if (isset($rules['bands']) && is_array($rules['bands'])) {
            foreach ($rules['bands'] as $band) {
                $minWeight = (float) ($band['min_weight_kg'] ?? 0);
                $maxWeight = (float) ($band['max_weight_kg'] ?? 0);
                if ($weightKg < $minWeight) {
                    continue;
                }

                if ($maxWeight > 0 && $weightKg <= $maxWeight) {
                    if ($weightKg <= 0.5) {
                        return (float) (($profile === 'ordinary') ? ($band['ordinary_flat'] ?? 0) : ($band['battery_flat'] ?? $band['ordinary_flat'] ?? 0));
                    }

                    return $weightKg * (float) (($profile === 'ordinary') ? ($band['ordinary_per_kg'] ?? 0) : ($band['battery_per_kg'] ?? $band['ordinary_per_kg'] ?? 0));
                }
            }
        }

        if (!empty($rules)) {
            $minimumWeight = max((float) ($rules['minimum_weight_kg'] ?? 0), $weightKg);
            $perKg = (float) (($profile === 'ordinary') ? ($rules['ordinary_per_kg'] ?? 0) : ($rules['battery_per_kg'] ?? $rules['ordinary_per_kg'] ?? 0));
            return $minimumWeight * $perKg;
        }

        return null;
    }

    private function computeSeaFee(array $rules, float $weightKg, float $cbm): ?float
    {
        if ($rules === []) {
            return null;
        }

        $effectiveCbm = max((float) ($rules['minimum_cbm'] ?? 0), $cbm);
        $perCbm = (float) ($rules['per_cbm'] ?? 0);
        $fee = $effectiveCbm * $perCbm;

        $minimumWeight = (float) ($rules['minimum_weight_kg'] ?? 0);
        if ($minimumWeight > 0 && $weightKg < $minimumWeight) {
            $fee += ($minimumWeight - $weightKg) * (float) ($rules['overweight_surcharge_per_kg'] ?? 0);
        }

        if (!empty($rules['overweight_surcharge_per_kg']) && $weightKg > ($effectiveCbm * 1000)) {
            $fee += ($weightKg - ($effectiveCbm * 1000)) * (float) $rules['overweight_surcharge_per_kg'];
        }

        return $fee;
    }
}
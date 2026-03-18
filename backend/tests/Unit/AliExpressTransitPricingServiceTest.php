<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\SupplierCountry;
use App\Services\AliExpressTransitPricingService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AliExpressTransitPricingServiceTest extends TestCase
{
    #[Test]
    public function it_applies_default_margin_only_to_gaming_accessories(): void
    {
        $service = app(AliExpressTransitPricingService::class);
        $country = new SupplierCountry([
            'code' => 'TG',
            'name' => 'Togo',
            'currency_code' => 'XOF',
            'pricing_rules_json' => [
                'air' => [
                    'ordinary_per_kg' => 1000,
                    'minimum_weight_kg' => 0,
                ],
            ],
        ]);

        $gamingAccessory = new Product([
            'type' => 'item',
            'category' => 'accessory',
            'accessory_category' => 'gaming',
            'price' => 10000,
            'estimated_weight_grams' => 1000,
            'grouping_threshold' => 1,
        ]);

        $recharge = new Product([
            'type' => 'recharge',
            'price' => 10000,
        ]);

        $gamingPricing = $service->computeProductPricing($gamingAccessory, $country);
        $rechargePricing = $service->computeProductPricing($recharge, $country);

        $this->assertSame(17.0, $gamingPricing['margin_percent']);
        $this->assertGreaterThan(10000, $gamingPricing['final_price']);

        $this->assertSame(0.0, $rechargePricing['margin_percent']);
        $this->assertSame(10000.0, $rechargePricing['final_price']);
        $this->assertSame(0.0, $rechargePricing['transport_unit_fee']);
    }
}
<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use App\Models\RedeemStockAlert;
use App\Services\RedeemStockAlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RedeemStockAlertServiceTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_clears_the_low_stock_alert_when_restock_reaches_the_threshold(): void
    {
        $service = app(RedeemStockAlertService::class);

        $product = Product::factory()->create([
            'type' => 'recharge',
            'stock_low_threshold' => 10,
            'stock_alert_channel' => 'discord',
            'redeem_code_delivery' => true,
            'stock_mode' => 'redeem_pool',
        ]);

        $denomination = RedeemDenomination::create([
            'product_id' => $product->id,
            'code' => 'FF-110D',
            'label' => 'Free Fire 110D',
            'diamonds' => 110,
            'active' => true,
        ]);

        foreach (range(1, 5) as $index) {
            RedeemCode::create([
                'denomination_id' => $denomination->id,
                'code' => 'LOW-STOCK-' . $index,
                'status' => 'available',
            ]);
        }

        $service->notifyIfLowStock($denomination);

        $alert = RedeemStockAlert::where('denomination_id', $denomination->id)->first();
        $this->assertNotNull($alert);
        $this->assertEquals(5, $alert->last_notified_stock);
        $this->assertNotNull($alert->last_notified_at);

        foreach (range(6, 10) as $index) {
            RedeemCode::create([
                'denomination_id' => $denomination->id,
                'code' => 'RESTOCK-' . $index,
                'status' => 'available',
            ]);
        }

        $service->notifyIfLowStock($denomination->fresh());

        $alert->refresh();
        $this->assertNull($alert->last_notified_stock);
        $this->assertNull($alert->last_notified_at);

        RedeemCode::query()
            ->where('denomination_id', $denomination->id)
            ->where('code', 'RESTOCK-10')
            ->update(['status' => 'used']);

        $service->notifyIfLowStock($denomination->fresh());

        $alert->refresh();
        $this->assertEquals(9, $alert->last_notified_stock);
        $this->assertNotNull($alert->last_notified_at);
    }
}
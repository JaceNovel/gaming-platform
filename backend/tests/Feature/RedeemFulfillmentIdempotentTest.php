<?php

namespace Tests\Feature;

use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use App\Models\User;
use App\Services\RedeemCodeAllocator;
use App\Services\RedeemStockAlertService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class RedeemFulfillmentIdempotentTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function redeem_fulfillment_is_idempotent(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $product = Product::factory()->create([
            'type' => 'redeem',
            'price' => 5000,
        ]);

        $denomination = RedeemDenomination::create([
            'product_id' => $product->id,
            'code' => '110D',
            'label' => 'Free Fire 110D',
            'diamonds' => 110,
            'active' => true,
        ]);

        $codeA = RedeemCode::create([
            'denomination_id' => $denomination->id,
            'code' => 'CODE-AAA-111',
            'status' => 'available',
        ]);
        $codeB = RedeemCode::create([
            'denomination_id' => $denomination->id,
            'code' => 'CODE-BBB-222',
            'status' => 'available',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'type' => 'redeem',
            'status' => Order::STATUS_PAYMENT_SUCCESS,
            'total_price' => 5000,
        ]);

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'redeem_denomination_id' => $denomination->id,
            'quantity' => 1,
            'price' => 5000,
            'delivery_status' => 'pending',
        ]);

        $job = new ProcessRedeemFulfillment($order->id);
        $job->handle(
            app(RedeemCodeAllocator::class),
            app(RedeemStockAlertService::class),
            app(NotificationService::class)
        );

        $item->refresh();
        $this->assertNotNull($item->redeem_code_id);

        $assignedCodeId = $item->redeem_code_id;

        $job->handle(
            app(RedeemCodeAllocator::class),
            app(RedeemStockAlertService::class),
            app(NotificationService::class)
        );

        $item->refresh();
        $this->assertEquals($assignedCodeId, $item->redeem_code_id);

        $this->assertEquals('sent', RedeemCode::find($assignedCodeId)->status);
        $this->assertEquals('available', RedeemCode::where('id', $codeB->id)->value('status'));
    }

    #[Test]
    public function redeem_fulfillment_works_for_products_with_active_denomination_even_if_not_flagged(): void
    {
        Mail::fake();

        $user = User::factory()->create();

        // Two distinct products that represent the same 110D offering.
        // One is correctly flagged, the other is "misconfigured" but has an active denomination.
        $productFlagged = Product::factory()->create([
            'type' => 'redeem',
            'price' => 5000,
        ]);
        $productUnflagged = Product::factory()->create([
            'type' => 'subscription',
            'stock_mode' => 'manual',
            'redeem_code_delivery' => false,
            // Same denomination, but product isn't flagged. It must still deliver via redeem_sku.
            'redeem_sku' => '110D',
            'price' => 5000,
        ]);

        $denom = RedeemDenomination::create([
            'product_id' => $productFlagged->id,
            'code' => '110D',
            'label' => 'Free Fire 110D',
            'diamonds' => 110,
            'active' => true,
        ]);

        RedeemCode::create([
            'denomination_id' => $denom->id,
            'code' => 'CODE-A-110D',
            'status' => 'available',
        ]);
        RedeemCode::create([
            'denomination_id' => $denom->id,
            'code' => 'CODE-B-110D',
            'status' => 'available',
        ]);

        $orderA = Order::create([
            'user_id' => $user->id,
            'type' => 'redeem',
            'status' => Order::STATUS_PAYMENT_SUCCESS,
            'total_price' => 5000,
        ]);
        OrderItem::create([
            'order_id' => $orderA->id,
            'product_id' => $productFlagged->id,
            'quantity' => 1,
            'price' => 5000,
            'delivery_status' => 'pending',
        ]);

        $orderB = Order::create([
            'user_id' => $user->id,
            'type' => 'subscription',
            'status' => Order::STATUS_PAYMENT_SUCCESS,
            'total_price' => 5000,
        ]);
        OrderItem::create([
            'order_id' => $orderB->id,
            'product_id' => $productUnflagged->id,
            'quantity' => 1,
            'price' => 5000,
            'delivery_status' => 'pending',
        ]);

        $jobA = new ProcessRedeemFulfillment($orderA->id);
        $jobA->handle(
            app(RedeemCodeAllocator::class),
            app(RedeemStockAlertService::class),
            app(NotificationService::class)
        );

        $jobB = new ProcessRedeemFulfillment($orderB->id);
        $jobB->handle(
            app(RedeemCodeAllocator::class),
            app(RedeemStockAlertService::class),
            app(NotificationService::class)
        );

        $this->assertTrue($orderA->refresh()->requiresRedeemFulfillment());
        $this->assertTrue($orderB->refresh()->requiresRedeemFulfillment());

        $this->assertNotNull($orderA->orderItems()->first()->refresh()->redeem_code_id);
        $this->assertNotNull($orderB->orderItems()->first()->refresh()->redeem_code_id);
    }
}

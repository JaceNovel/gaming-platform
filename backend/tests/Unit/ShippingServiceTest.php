<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class ShippingServiceTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_computes_shipping_eta_from_physical_items()
    {
        $user = User::factory()->create();
        $productFast = Product::factory()->create([
            'shipping_required' => true,
            'delivery_type' => 'in_stock',
            'delivery_eta_days' => 2,
        ]);
        $productSlow = Product::factory()->create([
            'shipping_required' => true,
            'delivery_type' => 'preorder',
            'delivery_eta_days' => 14,
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'status' => 'paid',
            'total_price' => 10000,
            'items' => [],
            'reference' => 'ORD-SHIP-1',
            'shipping_status' => 'pending',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $productFast->id,
            'quantity' => 1,
            'price' => 5000,
            'is_physical' => true,
            'delivery_type' => 'in_stock',
            'delivery_eta_days' => 2,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $productSlow->id,
            'quantity' => 1,
            'price' => 5000,
            'is_physical' => true,
            'delivery_type' => 'preorder',
            'delivery_eta_days' => 14,
        ]);

        $service = app(ShippingService::class);
        $service->computeShippingForOrder($order);

        $order->refresh();
        $this->assertEquals(14, $order->shipping_eta_days);
        $this->assertNotNull($order->shipping_estimated_date);
    }

    #[Test]
    public function it_generates_delivery_note_pdf_for_paid_order()
    {
        Storage::fake('public');

        $user = User::factory()->create(['email' => 'client@test.com']);
        $product = Product::factory()->create([
            'shipping_required' => true,
            'delivery_type' => 'in_stock',
            'delivery_eta_days' => 2,
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'status' => 'paid',
            'total_price' => 5000,
            'items' => [],
            'reference' => 'ORD-SHIP-2',
            'shipping_status' => 'pending',
            'shipping_address_line1' => 'Rue 123',
            'shipping_city' => 'Abidjan',
            'shipping_country_code' => 'CI',
            'shipping_phone' => '01020304',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'price' => 5000,
            'is_physical' => true,
            'delivery_type' => 'in_stock',
            'delivery_eta_days' => 2,
        ]);

        $service = app(ShippingService::class);
        $result = $service->generateDeliveryNotePdf($order);

        $order->refresh();
        $this->assertNotEmpty($result['path']);
        $this->assertEquals($result['path'], $order->shipping_document_path);
        Storage::disk('public')->assertExists($result['path']);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class ShippingAccessTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function non_admin_cannot_access_shipping_document()
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'user']);
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
            'reference' => 'ORD-SHIP-3',
            'shipping_status' => 'pending',
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

        app(ShippingService::class)->generateDeliveryNotePdf($order);

        Sanctum::actingAs($user, [], 'sanctum');

        $this->getJson('/api/admin/orders/' . $order->id . '/shipping/document')
            ->assertStatus(403);
    }

    #[Test]
    public function admin_can_download_shipping_document()
    {
        Storage::fake('public');

        $admin = User::factory()->create(['role' => 'admin_super']);
        $product = Product::factory()->create([
            'shipping_required' => true,
            'delivery_type' => 'in_stock',
            'delivery_eta_days' => 2,
        ]);

        $order = Order::create([
            'user_id' => $admin->id,
            'status' => 'paid',
            'total_price' => 5000,
            'items' => [],
            'reference' => 'ORD-SHIP-4',
            'shipping_status' => 'pending',
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

        app(ShippingService::class)->generateDeliveryNotePdf($order);

        Sanctum::actingAs($admin, [], 'sanctum');

        $this->get('/api/admin/orders/' . $order->id . '/shipping/document')
            ->assertStatus(200);
    }
}

<?php

namespace Tests\Feature;

use App\Jobs\ProcessOrderDelivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\CinetPayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_initiate_cinetpay_payment_from_order()
    {
        $user = User::factory()->create();
        $product = Product::factory()->create([
            'type' => 'account',
            'price' => 1500,
            'stock' => 5,
            'is_active' => true,
        ]);

        Sanctum::actingAs($user, [], 'sanctum');

        $orderResponse = $this->postJson('/api/orders', [
            'items' => [
                ['product_id' => $product->id, 'qty' => 2],
            ],
        ])->assertStatus(201);

        $orderId = $orderResponse->json('order.id');
        $expectedTotal = $product->price * 2;

        $this->assertEquals($expectedTotal, (float) $orderResponse->json('order.total_price'));

        $this->mock(CinetPayService::class, function ($mock) {
            $mock->shouldReceive('initiatePayment')->andReturn('https://pay.test/123');
        });

        $resp = $this->postJson('/api/payments/cinetpay/init', [
            'order_id' => $orderId,
            'payment_method' => 'cinetpay',
        ])->assertStatus(200);

        $this->assertTrue($resp->json('success'));
        $this->assertEquals('https://pay.test/123', $resp->json('data.payment_url'));

        $payment = Payment::first();
        $this->assertNotNull($payment);
        $this->assertEquals('initiated', $payment->status);
        $this->assertEquals($expectedTotal, (float) $payment->amount);

        $order = Order::find($orderId);
        $this->assertEquals($payment->id, $order->payment_id);
    }

    public function test_webhook_is_idempotent_and_updates_statuses()
    {
        Queue::fake();

        $user = User::factory()->create();
        $product = Product::factory()->create([
            'type' => 'account',
            'price' => 2000,
            'stock' => 5,
            'is_active' => true,
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'status' => 'pending',
            'total_price' => 2000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1, 'price' => 2000],
            ],
            'reference' => 'ORD-TEST',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'price' => 2000,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'amount' => 2000,
            'method' => 'cinetpay',
            'status' => 'initiated',
            'transaction_id' => 'tx123',
        ]);

        $order->update(['payment_id' => $payment->id]);

        $this->mock(CinetPayService::class, function ($mock) {
            $mock->shouldReceive('validateWebhook')->andReturn(true);
        });

        $payload = [
            'cpm_trans_id' => 'tx123',
            'cpm_trans_status' => 'SUCCESS',
            'cpm_amount' => 2000,
            'signature' => 'ok',
        ];

        $this->postJson('/api/payments/cinetpay/webhook', $payload)
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        $payment->refresh();
        $order->refresh();

        $this->assertEquals('paid', $payment->status);
        $this->assertEquals('paid', $order->status);

        Queue::assertPushed(ProcessOrderDelivery::class, 1);

        // Idempotent second call
        $this->postJson('/api/payments/cinetpay/webhook', $payload)
            ->assertStatus(200);

        Queue::assertPushed(ProcessOrderDelivery::class, 1);
        $this->assertEquals('paid', $payment->fresh()->status);
    }
}

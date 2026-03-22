<?php

namespace Tests\Unit;

use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SiteSetting;
use App\Models\User;
use App\Services\PaymentSettlementService;
use App\Services\ShippingService;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PaymentSettlementServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_purchase_queues_admin_email_for_assigned_responsibility(): void
    {
        Queue::fake();

        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'ops@example.com',
        ]);

        SiteSetting::query()->create([
            'key' => 'admin_responsibility_assignments',
            'value' => json_encode([
                'recharges' => [$admin->id],
            ]),
        ]);

        $buyer = User::factory()->create();
        $product = Product::factory()->create([
            'name' => 'Free Fire Recharge',
            'type' => 'recharge',
            'price' => 5000,
            'shipping_required' => false,
            'is_active' => true,
        ]);

        $order = Order::query()->create([
            'user_id' => $buyer->id,
            'type' => 'purchase',
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'total_price' => 5000,
            'items' => [],
            'reference' => 'ORD-TEST-001',
            'meta' => [],
        ]);

        $order->orderItems()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'price' => 5000,
            'shipping_fee' => 0,
            'delivery_status' => 'pending',
            'is_physical' => false,
        ]);

        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'amount' => 5000,
            'method' => 'moneroo',
            'status' => 'pending',
            'transaction_id' => 'MONEROO-TEST-001',
        ]);

        $service = new PaymentSettlementService(
            app(WalletService::class),
            app(ShippingService::class),
        );

        $service->settle($payment, 'completed', [
            'provider' => 'moneroo',
            'provider_transaction_id' => 'MONEROO-TEST-001',
            'attempt_currency' => 'XOF',
            'provider_payload' => ['id' => 'MONEROO-TEST-001'],
        ]);

        $this->assertDatabaseHas('email_logs', [
            'user_id' => $admin->id,
            'to' => 'ops@example.com',
            'type' => 'admin_order_paid',
            'status' => 'pending',
        ]);

        $this->assertSame(1, EmailLog::query()->where('type', 'admin_order_paid')->count());
    }
}
<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Services\CinetPayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Mockery;
use PHPUnit\Framework\Attributes\Test;

class PaymentWebhookIdempotentTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function webhook_is_idempotent(): void
    {
        $order = Order::factory()->create([
            'status' => 'pending',
            'total_price' => 5000,
        ]);

        $payment = Payment::factory()->create([
            'order_id' => $order->id,
            'amount' => 5000,
            'status' => 'pending',
            'method' => 'cinetpay',
            'transaction_id' => 'TXN-TEST-123',
        ]);

        $this->mock(CinetPayService::class, function ($mock) {
            $mock->shouldReceive('verifyWebhookSignature')->andReturn(true);
            $mock->shouldReceive('verifyTransaction')->andReturn(['data' => ['amount' => 5000]]);
            $mock->shouldReceive('normalizeStatus')->andReturn('paid');
        });

        $payload = [
            'cpm_trans_id' => 'TXN-TEST-123',
            'cpm_trans_status' => 'SUCCESS',
            'cpm_amount' => 5000,
            'signature' => 'valid',
        ];

        $this->postJson('/api/payments/cinetpay/webhook', $payload)->assertOk();
        $this->postJson('/api/payments/cinetpay/webhook', $payload)->assertOk();

        $payment->refresh();
        $this->assertEquals('paid', $payment->status);
    }
}

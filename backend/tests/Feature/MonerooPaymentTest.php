<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\MonerooService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MonerooPaymentTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function bank_card_payment_method_maps_to_moneroo_card_method(): void
    {
        $user = User::factory()->create([
            'name' => 'Checkout User',
            'email' => 'checkout-user@example.com',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'total_price' => 3200,
            'items' => [
                ['product_id' => 1, 'quantity' => 1, 'price' => 3200],
            ],
            'reference' => 'ORD-MONEROO-CARD-001',
        ]);

        $this->mock(MonerooService::class, function ($mock) use ($order, $user) {
            $mock->shouldReceive('initPayment')
                ->once()
                ->withArgs(function ($passedOrder, $passedUser, array $options) use ($order, $user) {
                    return (int) $passedOrder->id === (int) $order->id
                        && (int) $passedUser->id === (int) $user->id
                        && ($options['methods'] ?? null) === ['card'];
                })
                ->andReturn([
                    'payment_url' => 'https://checkout.moneroo.test/card-123',
                    'transaction_id' => 'moneroo-card-123',
                    'raw' => [
                        'checkout_url' => 'https://checkout.moneroo.test/card-123',
                    ],
                ]);
        });

        $this->actingAs($user, 'sanctum');

        $response = $this->postJson('/api/payments/moneroo/init', [
            'order_id' => $order->id,
            'payment_method' => 'bank_card',
            'amount' => 3200,
            'currency' => 'XOF',
            'customer_email' => $user->email,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.payment_url', 'https://checkout.moneroo.test/card-123')
            ->assertJsonPath('data.transaction_id', 'moneroo-card-123');

        $payment = Payment::query()->first();

        $this->assertNotNull($payment);
        $this->assertSame('moneroo', $payment->method);
        $this->assertSame('moneroo-card-123', $payment->transaction_id);
    }
}
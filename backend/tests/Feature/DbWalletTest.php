<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Models\WalletAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DbWalletTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_creates_wallet_with_wallet_id_on_registration(): void
    {
        $payload = [
            'name' => 'Test',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'countryCode' => 'CM',
            'countryName' => 'Cameroon',
        ];

        $res = $this->postJson('/api/auth/register', $payload);
        $res->assertStatus(201);

        $userId = (int) ($res->json('user.id') ?? 0);
        $this->assertGreaterThan(0, $userId);

        $this->assertDatabaseHas('wallet_accounts', [
            'user_id' => $userId,
        ]);

        $wallet = WalletAccount::where('user_id', $userId)->first();
        $this->assertNotNull($wallet);
        $this->assertNotEmpty($wallet->wallet_id);
        $this->assertStringStartsWith('DBW-', (string) $wallet->wallet_id);
    }

    #[Test]
    public function wallet_payment_requires_available_funds_equal_or_above_order_total(): void
    {
        $user = User::factory()->create();

        $wallet = WalletAccount::create([
            'user_id' => $user->id,
            'wallet_id' => 'DBW-TESTWALLETID0000000000000000',
            'currency' => 'FCFA',
            'balance' => 100,
            'bonus_balance' => 0,
            'bonus_expires_at' => null,
            'status' => 'active',
        ]);

        $product = Product::factory()->create([
            'type' => 'account',
            'price' => 100,
        ]);

        $order = Order::factory()->create([
            'user_id' => $user->id,
            'total_price' => 100,
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'meta' => [
                'sales_recorded_at' => now()->toIso8601String(),
                'fulfillment_dispatched_at' => now()->toIso8601String(),
            ],
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'price' => 100,
        ]);

        $this->actingAs($user, 'sanctum');

        $payRes = $this->postJson('/api/payments/wallet/pay', ['order_id' => $order->id]);
        $payRes->assertStatus(200);

        $wallet->refresh();
        $this->assertEquals(0.0, (float) $wallet->balance);
    }

    #[Test]
    public function welcome_bonus_can_be_used_only_for_recharge_orders(): void
    {
        $user = User::factory()->create();

        $wallet = WalletAccount::create([
            'user_id' => $user->id,
            'wallet_id' => 'DBW-TESTWALLETID0000000000000001',
            'currency' => 'FCFA',
            'balance' => 1000,
            'bonus_balance' => 500,
            'bonus_expires_at' => now()->addHour(),
            'status' => 'active',
        ]);

        $rechargeProduct = Product::factory()->create([
            'type' => 'recharge',
            'price' => 1200,
        ]);

        $rechargeOrder = Order::factory()->create([
            'user_id' => $user->id,
            'total_price' => 1200,
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'meta' => [
                'sales_recorded_at' => now()->toIso8601String(),
                'fulfillment_dispatched_at' => now()->toIso8601String(),
            ],
        ]);

        OrderItem::create([
            'order_id' => $rechargeOrder->id,
            'product_id' => $rechargeProduct->id,
            'quantity' => 1,
            'price' => 1200,
        ]);

        $this->actingAs($user, 'sanctum');

        $payRes = $this->postJson('/api/payments/wallet/pay', ['order_id' => $rechargeOrder->id]);
        $payRes->assertStatus(200);

        $wallet->refresh();
        $this->assertEquals(300.0, (float) $wallet->balance);
        $this->assertEquals(0.0, (float) $wallet->bonus_balance);

        // Non-recharge order should not consume bonus.
        $wallet->update([
            'balance' => 1000,
            'bonus_balance' => 500,
            'bonus_expires_at' => now()->addHour(),
        ]);

        $nonRechargeProduct = Product::factory()->create([
            'type' => 'account',
            'price' => 1200,
        ]);

        $nonRechargeOrder = Order::factory()->create([
            'user_id' => $user->id,
            'total_price' => 1200,
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'meta' => [
                'sales_recorded_at' => now()->toIso8601String(),
                'fulfillment_dispatched_at' => now()->toIso8601String(),
            ],
        ]);

        OrderItem::create([
            'order_id' => $nonRechargeOrder->id,
            'product_id' => $nonRechargeProduct->id,
            'quantity' => 1,
            'price' => 1200,
        ]);

        $payRes2 = $this->postJson('/api/payments/wallet/pay', ['order_id' => $nonRechargeOrder->id]);
        $payRes2->assertStatus(422);
    }
}

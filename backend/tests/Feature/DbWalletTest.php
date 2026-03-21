<?php

namespace Tests\Feature;

use App\Jobs\ProcessPayout;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\Product;
use App\Models\User;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\FedaPayService;
use App\Services\MonerooService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
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
            'phone' => '+237670000000',
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

    #[Test]
    public function wallet_can_transfer_to_another_user_without_fee_using_wallet_id(): void
    {
        $sender = User::factory()->create([
            'name' => 'ALPHA',
            'phone' => '22501010101',
        ]);
        $recipient = User::factory()->create([
            'name' => 'BRAVO',
            'phone' => '22502020202',
        ]);

        $senderWallet = WalletAccount::create([
            'user_id' => $sender->id,
            'wallet_id' => 'DBW-SENDER-0001',
            'currency' => 'FCFA',
            'balance' => 12000,
            'bonus_balance' => 0,
            'reward_balance' => 0,
            'status' => 'active',
        ]);

        $recipientWallet = WalletAccount::create([
            'user_id' => $recipient->id,
            'wallet_id' => 'DBW-RECEIVER-0001',
            'currency' => 'FCFA',
            'balance' => 500,
            'bonus_balance' => 0,
            'reward_balance' => 0,
            'status' => 'active',
        ]);

        $this->actingAs($sender, 'sanctum');

        $res = $this->postJson('/api/wallet/transfer', [
            'recipient_query' => $recipientWallet->wallet_id,
            'amount' => 3000,
        ]);

        $res->assertCreated()
            ->assertJsonPath('data.recipient.username', 'BRAVO');

        $senderWallet->refresh();
        $recipientWallet->refresh();

        $this->assertSame(9000.0, (float) $senderWallet->balance);
        $this->assertSame(3500.0, (float) $recipientWallet->balance);
        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_account_id' => $senderWallet->id,
            'type' => 'debit',
            'amount' => 3000,
            'status' => 'success',
        ]);
        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_account_id' => $recipientWallet->id,
            'type' => 'credit',
            'amount' => 3000,
            'status' => 'success',
        ]);

        $debit = WalletTransaction::query()->where('wallet_account_id', $senderWallet->id)->latest('id')->first();
        $this->assertSame('BRAVO', $debit?->meta['recipient_username'] ?? null);
        $this->assertSame('DBW-RECEIVER-0001', $debit?->meta['recipient_wallet_id'] ?? null);
    }

    #[Test]
    public function recipient_lookup_accepts_username_and_phone(): void
    {
        $sender = User::factory()->create([
            'name' => 'SENDER',
            'phone' => '22511111111',
        ]);
        $recipient = User::factory()->create([
            'name' => 'TARGET',
            'phone' => '22599998888',
        ]);

        WalletAccount::create([
            'user_id' => $recipient->id,
            'wallet_id' => 'DBW-TARGET-0001',
            'currency' => 'FCFA',
            'balance' => 0,
            'bonus_balance' => 0,
            'reward_balance' => 0,
            'status' => 'active',
        ]);

        $this->actingAs($sender, 'sanctum');

        $this->getJson('/api/wallet/recipient?query=target')
            ->assertOk()
            ->assertJsonPath('recipient.username', 'TARGET');

        $this->getJson('/api/wallet/recipient?query=22599998888')
            ->assertOk()
            ->assertJsonPath('recipient.username', 'TARGET');
    }

    #[Test]
    public function registration_rejects_duplicate_username_case_insensitively(): void
    {
        User::factory()->create([
            'name' => 'PRIME',
            'email' => 'prime1@example.com',
            'phone' => '22512312312',
        ]);

        $payload = [
            'name' => 'prime',
            'email' => 'prime2@example.com',
            'phone' => '+22507070707',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'countryCode' => 'CI',
            'countryName' => 'Côte d\'Ivoire',
        ];

        $res = $this->postJson('/api/auth/register', $payload);

        $res->assertStatus(422)
            ->assertJsonPath('errors.name.0', 'Pseudo indisponible.');
    }

    #[Test]
    public function wallet_withdraw_starts_fedapay_payout_immediately(): void
    {
        $user = User::factory()->create([
            'name' => 'WITHDRAWER',
            'phone' => '22507070707',
            'country_code' => 'CI',
        ]);

        $wallet = WalletAccount::create([
            'user_id' => $user->id,
            'wallet_id' => 'DBW-WITHDRAW-0001',
            'currency' => 'FCFA',
            'balance' => 10000,
            'bonus_balance' => 0,
            'reward_balance' => 0,
            'status' => 'active',
        ]);

        $mockFedaPay = Mockery::mock(FedaPayService::class)->makePartial();
        $mockFedaPay->shouldReceive('createPayout')->once()->andReturn([
            'id' => 987654,
            'reference' => 'FDP-PAYOUT-REF',
            'status' => 'pending',
        ]);
        $mockFedaPay->shouldReceive('startPayout')->once()->andReturn([
            [
                'id' => 987654,
                'reference' => 'FDP-PAYOUT-REF',
                'status' => 'processing',
            ],
        ]);
        $mockFedaPay->shouldReceive('retrievePayout')->once()->andReturn([
            'id' => 987654,
            'reference' => 'FDP-PAYOUT-REF',
            'status' => 'processing',
        ]);
        $this->app->instance(FedaPayService::class, $mockFedaPay);

        $this->actingAs($user, 'sanctum');

        $response = $this->postJson('/api/wallet/withdraw', [
            'amount' => 5000,
            'payoutDetails' => [
                'phone' => '22507070707',
                'country' => 'CI',
                'method' => 'mobile_money',
                'name' => 'Withdrawer Test',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.withdraw_fee_amount', 1000)
            ->assertJsonPath('data.payout.status', 'processing')
            ->assertJsonPath('data.payout.provider_ref', 'FDP-PAYOUT-REF');

        $wallet->refresh();

        $this->assertSame(4000.0, (float) $wallet->balance);

        $payout = Payout::query()->latest('created_at')->first();
        $this->assertNotNull($payout);
        $this->assertSame('processing', $payout->status);
        $this->assertSame('FDP-PAYOUT-REF', $payout->provider_ref);

        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_account_id' => $wallet->id,
            'type' => 'debit',
            'amount' => 6000,
            'status' => 'pending',
        ]);
    }

    #[Test]
    public function payout_sync_recovers_provider_id_from_fedapay_search_before_retrieve(): void
    {
        config()->set('fedapay.secret_key', 'test-secret');

        $user = User::factory()->create([
            'name' => 'SYNC PAYOUT USER',
            'phone' => '22507070707',
            'country_code' => 'CI',
        ]);

        $wallet = WalletAccount::create([
            'user_id' => $user->id,
            'wallet_id' => 'DBW-PAYOUT-SYNC-0001',
            'currency' => 'FCFA',
            'balance' => 4000,
            'bonus_balance' => 0,
            'reward_balance' => 0,
            'status' => 'active',
        ]);

        $payout = Payout::create([
            'user_id' => $user->id,
            'wallet_account_id' => $wallet->id,
            'amount' => 3000,
            'fee' => 1000,
            'total_debit' => 4000,
            'currency' => 'FCFA',
            'country' => 'CI',
            'phone' => '22507070707',
            'provider' => 'FEDAPAY',
            'provider_ref' => 'FDP-PAYOUT-REF',
            'status' => 'processing',
            'idempotency_key' => 'PAYOUT-SYNC-0001',
        ]);

        $mockFedaPay = Mockery::mock(FedaPayService::class)->makePartial();
        $mockFedaPay->shouldReceive('findPayout')->once()->andReturn([
            'id' => 987654,
            'reference' => 'FDP-PAYOUT-REF',
            'merchant_reference' => 'PAYOUT-SYNC-0001',
            'status' => 'processing',
        ]);
        $mockFedaPay->shouldReceive('retrievePayout')->once()->with(987654)->andReturn([
            'id' => 987654,
            'reference' => 'FDP-PAYOUT-REF',
            'merchant_reference' => 'PAYOUT-SYNC-0001',
            'status' => 'processing',
        ]);
        $mockFedaPay->shouldReceive('createPayout')->never();
        $mockFedaPay->shouldReceive('startPayout')->never();

        $job = new ProcessPayout($payout->id);
        $job->handle(
            $mockFedaPay,
            Mockery::mock(\App\Services\WalletService::class)->shouldIgnoreMissing(),
            Mockery::mock(\App\Services\WalletPayoutNotificationService::class)->shouldIgnoreMissing(),
        );

        $payout->refresh();

        $this->assertSame('processing', $payout->status);
        $this->assertSame('FDP-PAYOUT-REF', $payout->provider_ref);
        $this->assertDatabaseHas('payout_events', [
            'payout_id' => $payout->id,
            'status' => 'processing',
        ]);
    }

    #[Test]
    public function wallet_topup_reuses_recent_pending_moneroo_payment(): void
    {
        $user = User::factory()->create([
            'name' => 'TOPUP USER',
            'email' => 'topup-user@example.com',
            'phone' => '22501020304',
            'country_code' => 'CI',
        ]);

        $wallet = WalletAccount::create([
            'user_id' => $user->id,
            'wallet_id' => 'DBW-TOPUP-REUSE-0001',
            'currency' => 'FCFA',
            'balance' => 0,
            'bonus_balance' => 0,
            'reward_balance' => 0,
            'status' => 'active',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'type' => 'wallet_topup',
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'total_price' => 5000,
            'items' => [],
            'meta' => [
                'type' => 'wallet_topup',
                'source' => 'wallet_page',
                'wallet_id' => $wallet->wallet_id,
                'wallet_account_id' => $wallet->id,
            ],
            'reference' => 'WTU-EXISTING-0001',
        ]);

        $walletTx = WalletTransaction::create([
            'wallet_account_id' => $wallet->id,
            'type' => 'credit',
            'amount' => 5000,
            'reference' => 'WTOPUP-WTU-EXISTING-0001',
            'meta' => [
                'type' => 'wallet_topup',
                'reason' => 'topup',
                'order_id' => $order->id,
            ],
            'status' => 'pending',
            'provider' => 'moneroo',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'wallet_transaction_id' => $walletTx->id,
            'amount' => 5000,
            'method' => 'moneroo',
            'status' => 'pending',
            'transaction_id' => 'moneroo-existing-123',
            'webhook_data' => [
                'source' => 'wallet_topup',
                'provider' => 'moneroo',
                'provider_currency' => 'XOF',
                'provider_amount' => 5000,
                'init_response' => [
                    'checkout_url' => 'https://checkout.moneroo.io/pay/existing-123',
                ],
            ],
        ]);

        $order->update(['payment_id' => $payment->id]);

        $mockMoneroo = Mockery::mock(MonerooService::class)->makePartial();
        $mockMoneroo->shouldReceive('initPayment')->never();
        $this->app->instance(MonerooService::class, $mockMoneroo);

        $this->actingAs($user, 'sanctum');

        $response = $this->postJson('/api/wallet/topup', [
            'amount' => 5000,
            'provider' => 'moneroo',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('reused', true)
            ->assertJsonPath('data.payment_url', 'https://checkout.moneroo.io/pay/existing-123')
            ->assertJsonPath('data.transaction_id', 'moneroo-existing-123')
            ->assertJsonPath('data.order_id', $order->id)
            ->assertJsonPath('data.payment_id', $payment->id)
            ->assertJsonPath('data.wallet_transaction_id', $walletTx->id);

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('wallet_transactions', 1);
    }

    #[Test]
    public function fedapay_completed_wallet_topup_status_reconciles_wallet_credit(): void
    {
        $user = User::factory()->create([
            'email' => 'wallet-topup@example.com',
        ]);

        $wallet = WalletAccount::create([
            'user_id' => $user->id,
            'wallet_id' => 'DBW-TOPUP-0001',
            'currency' => 'FCFA',
            'balance' => 0,
            'bonus_balance' => 0,
            'reward_balance' => 0,
            'status' => 'active',
        ]);

        $order = Order::factory()->create([
            'user_id' => $user->id,
            'type' => 'wallet_topup',
            'status' => Order::STATUS_PAYMENT_SUCCESS,
            'total_price' => 5000,
            'meta' => [
                'type' => 'wallet_topup',
                'source' => 'wallet_page',
                'wallet_id' => $wallet->wallet_id,
                'wallet_account_id' => $wallet->id,
            ],
            'reference' => 'WTU-STATUS-0001',
        ]);

        $walletTransaction = WalletTransaction::create([
            'wallet_account_id' => $wallet->id,
            'type' => 'credit',
            'amount' => 5000,
            'reference' => 'WTOPUP-WTU-STATUS-0001',
            'meta' => [
                'type' => 'wallet_topup',
                'reason' => 'topup',
                'order_id' => $order->id,
            ],
            'status' => 'pending',
            'provider' => 'fedapay',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'wallet_transaction_id' => $walletTransaction->id,
            'amount' => 5000,
            'method' => 'fedapay',
            'status' => 'completed',
            'transaction_id' => '123456789',
            'webhook_data' => [
                'source' => 'wallet_topup',
                'provider' => 'fedapay',
            ],
        ]);

        $order->update(['payment_id' => $payment->id]);

        $this->actingAs($user, 'sanctum');

        $this->getJson('/api/payments/fedapay/status?order_id=' . $order->id)
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.order_type', 'wallet_topup');

        $wallet->refresh();
        $walletTransaction->refresh();
        $order->refresh();

        $this->assertSame(5000.0, (float) $wallet->balance);
        $this->assertSame('success', (string) $walletTransaction->status);
        $this->assertNotNull($walletTransaction->paid_at);
        $this->assertNotEmpty($order->meta['wallet_credited_at'] ?? null);
    }
}

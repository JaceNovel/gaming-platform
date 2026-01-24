<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\User;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WalletTransferTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('transfer:minute:1');
    }

    public function test_wallet_topup_webhook_idempotent(): void
    {
        $user = User::factory()->create();
        $wallet = WalletAccount::create(['user_id' => $user->id, 'balance' => 0, 'currency' => 'FCFA', 'status' => 'active']);
        $reference = 'WTP-' . Str::random(8);
        $walletTx = WalletTransaction::create([
            'id' => (string) Str::uuid(),
            'wallet_account_id' => $wallet->id,
            'type' => 'credit',
            'amount' => 1000,
            'reference' => $reference,
            'status' => 'pending',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'type' => 'wallet_topup',
            'status' => 'pending',
            'total_price' => 1000,
            'reference' => $reference,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'wallet_transaction_id' => $walletTx->id,
            'amount' => 1000,
            'status' => 'initiated',
            'transaction_id' => 'tx-topup-1',
        ]);

        $order->update(['payment_id' => $payment->id]);

        $signatureString = 'tx-topup-1' . '1000' . '' . 'SUCCESS';
        $signature = hash_hmac('sha256', $signatureString, env('CINETPAY_WEBHOOK_SECRET'));

        $payload = [
            'cpm_trans_id' => 'tx-topup-1',
            'cpm_trans_status' => 'SUCCESS',
            'cpm_amount' => 1000,
            'cpm_currency' => '',
            'signature' => $signature,
        ];

        $this->postJson('/api/wallet/topup/webhook', $payload)->assertStatus(200);
        $this->postJson('/api/wallet/topup/webhook', $payload)->assertStatus(200);

        $wallet->refresh();
        $this->assertEquals(1000.00, (float) $wallet->balance);
    }

    public function test_transfer_init_debit_hold(): void
    {
        $user = User::factory()->create();
        $wallet = WalletAccount::create(['user_id' => $user->id, 'balance' => 10000, 'currency' => 'FCFA', 'status' => 'active']);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/transfers/init', [
            'amount' => 1000,
            'phone' => '+22899999999',
            'country' => 'TG',
        ]);

        $response->assertStatus(200);
        $wallet->refresh();
        $this->assertEquals(9000.00, (float) $wallet->balance);
    }

    public function test_transfer_webhook_success_idempotent(): void
    {
        $user = User::factory()->create();
        $wallet = WalletAccount::create(['user_id' => $user->id, 'balance' => 9000, 'currency' => 'FCFA', 'status' => 'active']);
        $idempotency = (string) Str::uuid();
        $walletTx = WalletTransaction::create([
            'id' => (string) Str::uuid(),
            'wallet_account_id' => $wallet->id,
            'type' => 'debit',
            'amount' => 1000,
            'reference' => $idempotency,
            'status' => 'pending',
        ]);

        $payout = Payout::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'wallet_account_id' => $wallet->id,
            'amount' => 900,
            'fee' => 100,
            'total_debit' => 1000,
            'currency' => 'FCFA',
            'country' => 'TG',
            'phone' => '+22899999999',
            'status' => 'processing',
            'idempotency_key' => $idempotency,
        ]);

        $signatureString = ($payloadId = 'prov-1') . '1000' . 'success';
        $signature = hash_hmac('sha256', $signatureString, env('CINETPAY_TRANSFER_WEBHOOK_SECRET'));
        $payload = [
            'transaction_id' => $payloadId,
            'amount' => 1000,
            'status' => 'success',
            'idempotency_key' => $idempotency,
            'signature' => $signature,
        ];

        $this->postJson('/api/transfers/cinetpay/webhook', $payload)->assertStatus(200);
        $this->postJson('/api/transfers/cinetpay/webhook', $payload)->assertStatus(200);

        $wallet->refresh();
        $this->assertEquals(9000.00, (float) $wallet->balance);
        $payout->refresh();
        $this->assertEquals('sent', $payout->status);
    }

    public function test_transfer_webhook_failed_refund(): void
    {
        $user = User::factory()->create();
        $wallet = WalletAccount::create(['user_id' => $user->id, 'balance' => 9000, 'currency' => 'FCFA', 'status' => 'active']);
        $idempotency = (string) Str::uuid();
        WalletTransaction::create([
            'id' => (string) Str::uuid(),
            'wallet_account_id' => $wallet->id,
            'type' => 'debit',
            'amount' => 1000,
            'reference' => $idempotency,
            'status' => 'pending',
        ]);

        $payout = Payout::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'wallet_account_id' => $wallet->id,
            'amount' => 900,
            'fee' => 100,
            'total_debit' => 1000,
            'currency' => 'FCFA',
            'country' => 'TG',
            'phone' => '+22899999999',
            'status' => 'processing',
            'idempotency_key' => $idempotency,
        ]);

        $signatureString = 'prov-2' . '1000' . 'failed';
        $signature = hash_hmac('sha256', $signatureString, env('CINETPAY_TRANSFER_WEBHOOK_SECRET'));
        $payload = [
            'transaction_id' => 'prov-2',
            'amount' => 1000,
            'status' => 'failed',
            'idempotency_key' => $idempotency,
            'signature' => $signature,
        ];

        $this->postJson('/api/transfers/cinetpay/webhook', $payload)->assertStatus(200);

        $wallet->refresh();
        $this->assertEquals(10000.00, (float) $wallet->balance);
        $payout->refresh();
        $this->assertEquals('failed', $payout->status);
    }
}

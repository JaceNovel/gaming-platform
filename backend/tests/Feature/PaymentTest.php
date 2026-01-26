<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\CinetPayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Mockery;
use PHPUnit\Framework\Attributes\Test;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $order;

    protected function setUp(): void
    {
        parent::setUp();

        // Créer un utilisateur de test
        $this->user = User::factory()->create();

        // Créer des produits de test
        $product = Product::factory()->create([
            'price' => 5000,
            'stock' => 10,
        ]);

        // Créer une commande de test
        $this->order = Order::factory()->create([
            'user_id' => $this->user->id,
            'total_price' => 5000,
            'status' => 'pending',
        ]);
    }

    #[Test]
    public function test_can_initiate_cinetpay_payment()
    {
        $this->actingAs($this->user, 'sanctum');

        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('initPayment')
            ->once()
            ->andReturn([
                'payment_url' => 'https://cinetpay.com/payment/123',
                'transaction_id' => 'TX-123',
                'raw' => ['code' => '201'],
            ]);
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        $paymentData = [
            'order_id' => $this->order->id,
            'payment_method' => 'cinetpay',
            'amount' => 5000,
            'currency' => 'XOF',
            'customer_email' => $this->user->email,
            'return_url' => 'https://badboyshop.com/payment/success',
            'cancel_url' => 'https://badboyshop.com/payment/cancel',
        ];

        $response = $this->postJson('/api/payments/cinetpay/init', $paymentData);

        $response->assertStatus(200)
            ->assertJsonPath('data.payment_url', 'https://cinetpay.com/payment/123')
            ->assertJsonPath('data.transaction_id', 'TX-123');

        // Vérifier que le paiement a été créé en base
        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order->id,
            'status' => 'initiated',
            'method' => 'cinetpay'
        ]);
    }

    #[Test]
    public function test_validates_required_fields_for_payment_initiation()
    {
        $this->actingAs($this->user, 'sanctum');

        $response = $this->postJson('/api/payments/cinetpay/init', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['order_id', 'payment_method', 'amount', 'currency']);
    }

    #[Test]
    public function test_handles_cinetpay_webhook_with_valid_signature()
    {
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('verifyWebhookSignature')->once()->andReturn(true);
        $mockCinetPay->shouldReceive('verifyTransaction')->once()->andReturn([
            'data' => ['amount' => 5000],
        ]);
        $mockCinetPay->shouldReceive('normalizeStatus')->once()->andReturn('paid');
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        $payment = Payment::factory()->create([
            'order_id' => $this->order->id,
            'amount' => 5000,
            'status' => 'pending',
            'method' => 'cinetpay',
            'transaction_id' => 'TEST123456',
        ]);

        $webhookData = [
            'transaction_id' => 'TEST123456',
            'cpm_trans_status' => 'SUCCESS',
            'cpm_amount' => 5000,
            'signature' => 'valid_signature_for_test',
        ];

        $response = $this->postJson('/api/payments/cinetpay/webhook', $webhookData);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $payment->refresh();
        $this->assertEquals('paid', $payment->status);
        $this->order->refresh();
        $this->assertEquals('paid', $this->order->status);
    }

    #[Test]
    public function test_handles_webhook_idempotency()
    {
        // Mock the CinetPay service
            $mockCinetPay = Mockery::mock(CinetPayService::class);
            $mockCinetPay->shouldReceive('verifyWebhookSignature')->once()->andReturn(true);
            $mockCinetPay->shouldReceive('verifyTransaction')->never();
            $mockCinetPay->shouldReceive('normalizeStatus')->never();
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        // Créer un paiement déjà complété
        $payment = Payment::factory()->create([
            'order_id' => $this->order->id,
            'amount' => 5000,
                'status' => 'paid',
            'method' => 'cinetpay',
            'transaction_id' => 'TEST123456'
        ]);

        $webhookData = [
            'cpm_trans_id' => 'TEST123456',
            'cpm_trans_status' => 'SUCCESS',
            'cpm_amount' => 5000,
            'cpm_currency' => 'CFA',
            'signature' => 'valid_signature_for_test'
        ];

        $response = $this->postJson('/api/payments/cinetpay/webhook', $webhookData);

        $response->assertStatus(200)
                ->assertJson(['success' => true, 'message' => 'Webhook already processed']);
    }

    #[Test]
    public function test_rejects_webhook_with_invalid_signature()
    {
        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('verifyWebhookSignature')
            ->once()
            ->andReturn(false);
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        $webhookData = [
            'cpm_trans_id' => 'TEST123456',
            'cpm_trans_status' => 'SUCCESS',
            'cpm_amount' => 5000,
            'cpm_currency' => 'CFA',
            'signature' => 'invalid_signature'
        ];

        $response = $this->postJson('/api/payments/cinetpay/webhook', $webhookData);

        $response->assertStatus(400)
                ->assertJson(['success' => false, 'message' => 'Invalid signature']);
    }

    #[Test]
    public function test_handles_failed_payment_webhook()
    {
        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('verifyWebhookSignature')
            ->once()
            ->andReturn(true);
        $mockCinetPay->shouldReceive('verifyTransaction')
            ->once()
            ->andReturn(['data' => ['amount' => 5000]]);
        $mockCinetPay->shouldReceive('normalizeStatus')
            ->once()
            ->andReturn('failed');
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        $payment = Payment::factory()->create([
            'order_id' => $this->order->id,
            'amount' => 5000,
            'status' => 'pending',
            'method' => 'cinetpay',
            'transaction_id' => 'TEST123456'
        ]);

        $webhookData = [
            'cpm_trans_id' => 'TEST123456',
            'cpm_trans_status' => 'FAILED',
            'cpm_amount' => 5000,
            'cpm_currency' => 'CFA',
            'signature' => 'valid_signature_for_test'
        ];

        $response = $this->postJson('/api/payments/cinetpay/webhook', $webhookData);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        // Vérifier que le paiement a été marqué comme échoué
        $payment->refresh();
        $this->assertEquals('failed', $payment->status);

        // Vérifier que la commande est également marquée comme échouée
        $this->order->refresh();
        $this->assertEquals('failed', $this->order->status);
    }

    #[Test]
    public function test_can_check_payment_status_via_endpoint()
    {
        $this->actingAs($this->user, 'sanctum');

        $order = Order::factory()->create([
            'user_id' => $this->user->id,
            'total_price' => 8000,
            'status' => 'pending',
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'amount' => 8000,
            'method' => 'cinetpay',
            'status' => 'pending',
            'transaction_id' => 'STAT123',
        ]);

        $order->update(['payment_id' => $payment->id]);

        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('verifyTransaction')->once()->andReturn(['data' => ['amount' => 8000]]);
        $mockCinetPay->shouldReceive('normalizeStatus')->once()->andReturn('paid');
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        $response = $this->getJson('/api/payments/cinetpay/status?order_id=' . $order->id);

        $response->assertStatus(200)
            ->assertJsonPath('data.payment_status', 'paid');

        $payment->refresh();
        $this->assertEquals('paid', $payment->status);
        $this->assertEquals('paid', $payment->order->status);
    }
}
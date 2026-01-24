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

    /** @test */
    public function it_can_initiate_cinetpay_payment()
    {
        $this->actingAs($this->user, 'sanctum');

        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('initiatePayment')
                    ->once()
                    ->andReturn('https://cinetpay.com/payment/123');
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        $paymentData = [
            'order_id' => $this->order->id,
            'payment_method' => 'cinetpay',
            'return_url' => 'https://badboyshop.com/payment/success',
            'cancel_url' => 'https://badboyshop.com/payment/cancel',
        ];

        $response = $this->postJson('/api/payments/cinetpay/init', $paymentData);

        $response->assertStatus(200)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'payment_url',
                        'payment_id',
                        'amount',
                        'currency'
                    ]
                ]);

        // Vérifier que le paiement a été créé en base
        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order->id,
            'status' => 'pending',
            'method' => 'cinetpay'
        ]);
    }

    /** @test */
    public function it_validates_required_fields_for_payment_initiation()
    {
        $this->actingAs($this->user, 'sanctum');

        $response = $this->postJson('/api/payments/cinetpay/init', []);

        $response->assertStatus(422)
                ->assertJsonValidationErrors(['order_id', 'payment_method']);
    }

    /** @test */
    public function it_handles_cinetpay_webhook_with_valid_signature()
    {
        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('validateWebhook')
                    ->once()
                    ->andReturn(true);
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        // Créer un paiement en attente
        $payment = Payment::factory()->create([
            'order_id' => $this->order->id,
            'amount' => 5000,
            'status' => 'pending',
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
                ->assertJson(['success' => true, 'message' => 'Webhook processed successfully']);

        // Vérifier que le paiement a été mis à jour
        $payment->refresh();
        $this->assertEquals('completed', $payment->status);

        // Vérifier que la commande a été mise à jour
        $this->order->refresh();
        $this->assertEquals('completed', $this->order->status);
    }

    /** @test */
    public function it_handles_webhook_idempotency()
    {
        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('validateWebhook')
                    ->once()
                    ->andReturn(true);
        $this->app->instance(CinetPayService::class, $mockCinetPay);

        // Créer un paiement déjà complété
        $payment = Payment::factory()->create([
            'order_id' => $this->order->id,
            'amount' => 5000,
            'status' => 'completed',
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

    /** @test */
    public function it_rejects_webhook_with_invalid_signature()
    {
        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('validateWebhook')
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

    /** @test */
    public function it_handles_failed_payment_webhook()
    {
        // Mock the CinetPay service
        $mockCinetPay = Mockery::mock(CinetPayService::class);
        $mockCinetPay->shouldReceive('validateWebhook')
                    ->once()
                    ->andReturn(true);
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
                ->assertJson(['success' => true, 'message' => 'Webhook processed successfully']);

        // Vérifier que le paiement a été marqué comme échoué
        $payment->refresh();
        $this->assertEquals('failed', $payment->status);

        // Vérifier que la commande reste en attente
        $this->order->refresh();
        $this->assertEquals('pending', $this->order->status);
    }
}
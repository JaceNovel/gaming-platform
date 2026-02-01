<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Services\FedaPayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FedaPayWebhookSignatureTest extends TestCase
{
    use RefreshDatabase;

    private function setWebhookSecret(string $secret): void
    {
        putenv('FEDAPAY_WEBHOOK_SECRET=' . $secret);
        $_ENV['FEDAPAY_WEBHOOK_SECRET'] = $secret;
        $_SERVER['FEDAPAY_WEBHOOK_SECRET'] = $secret;
    }

    private function postRawWebhook(string $raw, string $signatureHeader)
    {
        return $this->call(
            'POST',
            '/api/payments/fedapay/webhook',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_FEDAPAY_SIGNATURE' => $signatureHeader,
            ],
            $raw
        );
    }

    #[Test]
    public function header_t_v1_validates_timestamp_dot_raw_hex(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $order = Order::factory()->create([
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'total_price' => 5000,
            'reference' => 'ORD-TEST-1',
        ]);

        Payment::factory()->create([
            'order_id' => $order->id,
            'amount' => 5000,
            'status' => 'pending',
            'method' => 'fedapay',
            'transaction_id' => 'TX-FEDA-1',
        ]);

        $this->mock(FedaPayService::class, function ($mock) use ($order) {
            $mock->shouldReceive('retrieveTransaction')->andReturn([
                'status' => 'approved',
                'amount' => 5000,
                'currency' => ['iso' => 'XOF'],
                'merchant_reference' => $order->reference,
            ]);
        });

        $raw = '{"id":"evt_1","name":"transaction.approved","entity":{"id":"TX-FEDA-1","status":"approved","custom_metadata":{"order_id":' . $order->id . '}}}';
        $timestamp = '1769900000';
        $signedPayload = $timestamp . '.' . $raw;
        $sig = hash_hmac('sha256', $signedPayload, $secret);

        $resp = $this->postRawWebhook($raw, 't=' . $timestamp . ',v1=' . $sig);
        $resp->assertOk();

        $order->refresh();
        $this->assertSame(Order::STATUS_PAYMENT_SUCCESS, (string) $order->status);
    }

    #[Test]
    public function header_t_v1_accepts_multiple_v1_values(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $order = Order::factory()->create([
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'total_price' => 5000,
            'reference' => 'ORD-TEST-2',
        ]);

        Payment::factory()->create([
            'order_id' => $order->id,
            'amount' => 5000,
            'status' => 'pending',
            'method' => 'fedapay',
            'transaction_id' => 'TX-FEDA-2',
        ]);

        $this->mock(FedaPayService::class, function ($mock) use ($order) {
            $mock->shouldReceive('retrieveTransaction')->andReturn([
                'status' => 'approved',
                'amount' => 5000,
                'currency' => ['iso' => 'XOF'],
                'merchant_reference' => $order->reference,
            ]);
        });

        $raw = '{"id":"evt_2","name":"transaction.approved","entity":{"id":"TX-FEDA-2","status":"approved","custom_metadata":{"order_id":' . $order->id . '}}}';
        $timestamp = '1769900001';
        $sig = hash_hmac('sha256', $timestamp . '.' . $raw, $secret);

        $header = 't=' . $timestamp . ',v1=deadbeef,v1=' . $sig;
        $resp = $this->postRawWebhook($raw, $header);
        $resp->assertOk();
    }

    #[Test]
    public function raw_legacy_header_validates_hmac_on_raw_body(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $order = Order::factory()->create([
            'status' => Order::STATUS_PAYMENT_PROCESSING,
            'total_price' => 5000,
            'reference' => 'ORD-TEST-3',
        ]);

        Payment::factory()->create([
            'order_id' => $order->id,
            'amount' => 5000,
            'status' => 'pending',
            'method' => 'fedapay',
            'transaction_id' => 'TX-FEDA-3',
        ]);

        $this->mock(FedaPayService::class, function ($mock) use ($order) {
            $mock->shouldReceive('retrieveTransaction')->andReturn([
                'status' => 'approved',
                'amount' => 5000,
                'currency' => ['iso' => 'XOF'],
                'merchant_reference' => $order->reference,
            ]);
        });

        $raw = '{"id":"evt_3","name":"transaction.approved","entity":{"id":"TX-FEDA-3","status":"approved","custom_metadata":{"order_id":' . $order->id . '}}}';
        $sig = hash_hmac('sha256', $raw, $secret);

        $resp = $this->postRawWebhook($raw, $sig);
        $resp->assertOk();
    }

    #[Test]
    public function invalid_signature_returns_401(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $raw = '{"id":"evt_bad","name":"transaction.approved","entity":{"id":"TX-FEDA-X","status":"approved"}}';
        $timestamp = '1769900002';

        $resp = $this->postRawWebhook($raw, 't=' . $timestamp . ',v1=deadbeef');
        $resp->assertStatus(401);
        $resp->assertJson(['error' => 'invalid signature']);
    }
}

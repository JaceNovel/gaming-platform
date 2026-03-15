<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Models\User;
use App\Services\PayPalService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PayPalServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config()->set('paypal.client_id', 'test-client');
        config()->set('paypal.client_secret', 'test-secret');
        config()->set('paypal.environment', 'sandbox');
        config()->set('paypal.base_url', 'https://api-m.sandbox.paypal.com');
        config()->set('paypal.default_currency', 'EUR');
        config()->set('paypal.xof_to_eur_rate', 655.957);
        config()->set('paypal.webhook_id', 'WH-TEST-123');
    }

    public function test_it_converts_xof_to_eur_using_fixed_rate(): void
    {
        $service = new PayPalService();

        $converted = $service->convertAmount(6559.57, 'XOF', 'EUR');

        $this->assertSame(10.0, $converted);
    }

    public function test_it_creates_checkout_order_and_returns_approve_url(): void
    {
        Http::fake([
            'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
                'access_token' => 'sandbox-token',
                'expires_in' => 32000,
            ], 200),
            'https://api-m.sandbox.paypal.com/v2/checkout/orders' => Http::response([
                'id' => 'PAYPAL-ORDER-123',
                'status' => 'CREATED',
                'links' => [
                    [
                        'href' => 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123',
                        'rel' => 'approve',
                        'method' => 'GET',
                    ],
                ],
            ], 201),
        ]);

        $user = new User();
        $user->id = 7;
        $user->name = 'Kernelx';
        $user->email = 'kernelx@example.com';

        $order = new Order();
        $order->id = 55;
        $order->reference = 'ORD-55';
        $order->total_price = 10000;
        $order->setRelation('orderItems', collect());

        $service = new PayPalService();
        $result = $service->createCheckoutOrder($order, $user, [
            'amount' => 10000,
            'source_currency' => 'XOF',
            'currency' => 'EUR',
            'return_url' => 'https://api.example.com/api/payments/paypal/return?order_id=55',
            'cancel_url' => 'https://api.example.com/api/payments/paypal/return?order_id=55&cancelled=1',
        ]);

        $this->assertSame('PAYPAL-ORDER-123', $result['order_id']);
        $this->assertSame('https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123', $result['approve_url']);
        $this->assertSame('EUR', $result['provider_currency']);
        $this->assertSame(15.24, $result['provider_amount']);
    }

    public function test_it_verifies_paypal_webhook_signature(): void
    {
        Http::fake([
            'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
                'access_token' => 'sandbox-token',
                'expires_in' => 32000,
            ], 200),
            'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature' => Http::response([
                'verification_status' => 'SUCCESS',
            ], 200),
        ]);

        $service = new PayPalService();

        $verified = $service->verifyWebhookSignature([
            'paypal-transmission-id' => 'abc123',
            'paypal-transmission-time' => '2026-03-15T10:00:00Z',
            'paypal-transmission-sig' => 'signature',
            'paypal-auth-algo' => 'SHA256withRSA',
            'paypal-cert-url' => 'https://api-m.sandbox.paypal.com/certs/cert.pem',
        ], [
            'id' => 'WH-EVENT-1',
            'event_type' => 'CHECKOUT.ORDER.APPROVED',
            'resource' => ['id' => 'PAYPAL-ORDER-123'],
        ]);

        $this->assertTrue($verified);
    }

    public function test_it_extracts_order_id_from_capture_webhook_payload(): void
    {
        $service = new PayPalService();

        $orderId = $service->extractWebhookOrderId([
            'event_type' => 'PAYMENT.CAPTURE.COMPLETED',
            'resource' => [
                'id' => 'CAPTURE-456',
                'supplementary_data' => [
                    'related_ids' => [
                        'order_id' => 'PAYPAL-ORDER-123',
                    ],
                ],
            ],
        ]);

        $this->assertSame('PAYPAL-ORDER-123', $orderId);
    }
}
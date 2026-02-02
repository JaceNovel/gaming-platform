<?php

namespace Tests\Feature;

use App\Jobs\ProcessFedaPayWebhook;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
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

        $_ENV['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        $_SERVER['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        putenv('FEDAPAY_WEBHOOK_TOLERANCE=300');

        Queue::fake();

        $raw = '{"id":"evt_1","name":"transaction.approved","entity":{"id":"TX-FEDA-1","status":"approved","amount":5000,"custom_metadata":{"type":"order_payment","order_id":123}}}';
        $timestamp = '1769900000';

        $this->travelTo(Carbon::createFromTimestamp((int) $timestamp));

        $signedPayload = $timestamp . '.' . $raw;
        $sig = hash_hmac('sha256', $signedPayload, $secret);

        $resp = $this->postRawWebhook($raw, 't=' . $timestamp . ',v1=' . $sig);
        $resp->assertOk();

        Queue::assertPushed(ProcessFedaPayWebhook::class);
    }

    #[Test]
    public function header_t_v1_accepts_multiple_v1_values(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $_ENV['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        $_SERVER['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        putenv('FEDAPAY_WEBHOOK_TOLERANCE=300');

        Queue::fake();

        $raw = '{"id":"evt_2","name":"transaction.approved","entity":{"id":"TX-FEDA-2","status":"approved","amount":5000,"custom_metadata":{"type":"wallet_topup","wallet_transaction_id":"22222222-2222-2222-2222-222222222222","user_id":2}}}';
        $timestamp = '1769900001';

        $this->travelTo(Carbon::createFromTimestamp((int) $timestamp));

        $sig = hash_hmac('sha256', $timestamp . '.' . $raw, $secret);

        $header = 't=' . $timestamp . ',v1=deadbeef,v1=' . $sig;
        $resp = $this->postRawWebhook($raw, $header);
        $resp->assertOk();

        // wallet_topup events are acknowledged but ignored.
        Queue::assertNotPushed(ProcessFedaPayWebhook::class);
    }

    #[Test]
    public function invalid_signature_returns_401(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $_ENV['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        $_SERVER['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        putenv('FEDAPAY_WEBHOOK_TOLERANCE=300');

        $raw = '{"id":"evt_bad","name":"transaction.approved","entity":{"id":"TX-FEDA-X","status":"approved"}}';
        $timestamp = '1769900002';

        $this->travelTo(Carbon::createFromTimestamp((int) $timestamp));

        $resp = $this->postRawWebhook($raw, 't=' . $timestamp . ',v1=deadbeef');
        $resp->assertStatus(401);
        $resp->assertJson(['received' => false]);
    }

    #[Test]
    public function legacy_raw_signature_header_is_accepted(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $_ENV['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        $_SERVER['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        putenv('FEDAPAY_WEBHOOK_TOLERANCE=300');

        Queue::fake();

        $raw = '{"id":"evt_raw","name":"transaction.approved","entity":{"id":"TX-FEDA-RAW","status":"approved","amount":5000,"custom_metadata":{"type":"order_payment","order_id":123}}}';
        $sig = hash_hmac('sha256', $raw, $secret);

        $resp = $this->postRawWebhook($raw, $sig);
        $resp->assertOk();

        Queue::assertPushed(ProcessFedaPayWebhook::class);
    }

    #[Test]
    public function millisecond_timestamp_is_accepted_for_tolerance_check(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        $_ENV['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        $_SERVER['FEDAPAY_WEBHOOK_TOLERANCE'] = '300';
        putenv('FEDAPAY_WEBHOOK_TOLERANCE=300');

        $payload = [
            'name' => 'transaction.refunded',
            'object' => 'transaction',
            'entity' => [
                'id' => 123,
                'status' => 'refunded',
                'custom_metadata' => [
                    'type' => 'order_payment',
                    'order_id' => 1,
                ],
            ],
        ];

        Queue::fake();

        $raw = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $this->assertNotFalse($raw);

        $timestampSeconds = 1769900002;
        $timestampMs = (string) ($timestampSeconds * 1000);
        $this->travelTo(Carbon::createFromTimestamp($timestampSeconds));

        $sig = hash_hmac('sha256', $timestampMs . '.' . $raw, $secret);

        $resp = $this->postRawWebhook($raw, 't=' . $timestampMs . ',v1=' . $sig);
        $resp->assertOk();

        $resp->assertJson(['received' => true]);
        Queue::assertPushed(ProcessFedaPayWebhook::class);
    }
}

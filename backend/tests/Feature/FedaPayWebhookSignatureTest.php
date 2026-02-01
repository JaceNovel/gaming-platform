<?php

namespace Tests\Feature;

use App\Jobs\HandleFedapayWebhookWallet;
use App\Jobs\ProcessFedaPayWebhook;
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

        Queue::fake();

        $raw = '{"id":"evt_1","name":"transaction.approved","entity":{"id":"TX-FEDA-1","status":"approved","amount":5000,"custom_metadata":{"type":"wallet_topup","wallet_transaction_id":"11111111-1111-1111-1111-111111111111","user_id":1}}}';
        $timestamp = '1769900000';
        $signedPayload = $timestamp . '.' . $raw;
        $sig = hash_hmac('sha256', $signedPayload, $secret);

        $resp = $this->postRawWebhook($raw, 't=' . $timestamp . ',v1=' . $sig);
        $resp->assertOk();

        Queue::assertPushed(HandleFedapayWebhookWallet::class);

        Queue::assertNotPushed(ProcessFedaPayWebhook::class);
    }

    #[Test]
    public function header_t_v1_accepts_multiple_v1_values(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $this->setWebhookSecret($secret);

        Queue::fake();

        $raw = '{"id":"evt_2","name":"transaction.approved","entity":{"id":"TX-FEDA-2","status":"approved","amount":5000,"custom_metadata":{"type":"wallet_topup","wallet_transaction_id":"22222222-2222-2222-2222-222222222222","user_id":2}}}';
        $timestamp = '1769900001';
        $sig = hash_hmac('sha256', $timestamp . '.' . $raw, $secret);

        $header = 't=' . $timestamp . ',v1=deadbeef,v1=' . $sig;
        $resp = $this->postRawWebhook($raw, $header);
        $resp->assertOk();

        Queue::assertPushed(HandleFedapayWebhookWallet::class);
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
        $resp->assertJson(['received' => false]);
    }
}

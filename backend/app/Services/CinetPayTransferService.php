<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CinetPayTransferService
{
    private string $apiKey;
    private string $siteId;
    private string $secret;
    private string $baseUrl;
    private string $transferWebhookSecret;

    public function __construct()
    {
        $config = config('cinetpay');

        $this->apiKey = (string) ($config['api_key'] ?? '');
        $this->siteId = (string) ($config['site_id'] ?? '');
        $this->secret = (string) ($config['secret'] ?? '');
        $this->transferWebhookSecret = (string) ($config['transfer_webhook_secret'] ?? $this->secret);
        $base = $config['transfer_base_url'] ?? $config['base_url'] ?? 'https://api-checkout.cinetpay.com/v2';
        $this->baseUrl = rtrim((string) $base, '/') . '/';
    }

    public function getToken(): string
    {
        return Cache::remember('cinetpay_transfer_token', 50 * 60, function () {
            $response = Http::timeout(10)->post($this->baseUrl . 'auth/login', [
                'apikey' => $this->apiKey,
                'password' => $this->secret,
            ]);

            if (!$response->successful()) {
                throw new \RuntimeException('CinetPay auth failed: ' . $response->body());
            }

            $data = $response->json();
            if (empty($data['data']['token'])) {
                throw new \RuntimeException('CinetPay auth token missing');
            }

            return $data['data']['token'];
        });
    }

    public function transfer(float $amount, string $phone, string $country, string $idempotencyKey): array
    {
        $token = $this->getToken();

        $payload = [
            'amount' => $amount,
            'currency' => 'XOF',
            'phone_number' => $phone,
            'country' => strtoupper($country),
            'description' => 'BADBOYSHOP payout',
            'idempotency_key' => $idempotencyKey,
        ];

        $response = Http::timeout(15)
            ->withToken($token)
            ->post($this->baseUrl . 'transfer/money/send', $payload);

        if ($response->serverError()) {
            Log::error('CinetPay transfer server error', ['body' => $response->body()]);
            throw new \RuntimeException('CinetPay transfer server error');
        }

        $data = $response->json();

        if (!$response->successful()) {
            $message = $data['message'] ?? 'transfer failed';
            throw new \RuntimeException('CinetPay transfer error: ' . $message);
        }

        return [
            'provider_ref' => $data['data']['transaction_id'] ?? Str::uuid()->toString(),
            'raw' => $data,
            'status' => strtolower($data['code'] ?? '') === 'success' ? 'success' : 'pending',
        ];
    }

    public function validateWebhook(array $payload): bool
    {
        if (!isset($payload['signature'])) {
            return false;
        }

        $signatureString = ($payload['transaction_id'] ?? '') . ($payload['amount'] ?? '') . ($payload['status'] ?? '');
        $expected = hash_hmac('sha256', $signatureString, $this->transferWebhookSecret);

        return hash_equals($expected, $payload['signature']);
    }
}

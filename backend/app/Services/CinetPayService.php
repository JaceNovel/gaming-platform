<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CinetPayService
{
    private string $apiKey;
    private string $siteId;
    private string $secret;
    private string $baseUrl;
    private string $webhookSecret;
    private int $timeout;
    private string $defaultCurrency;
    private string $defaultChannels;

    public function __construct()
    {
        $config = config('cinetpay');

        // Prefer config(), but fall back to env() to avoid issues when config is cached
        // with stale/empty values in some production deployments.
        $this->apiKey = (string) ($config['api_key'] ?? env('CINETPAY_API_KEY', ''));
        $this->siteId = (string) ($config['site_id'] ?? env('CINETPAY_SITE_ID', ''));
        $this->secret = (string) ($config['secret'] ?? env('CINETPAY_SECRET', ''));
        $this->webhookSecret = (string) ($config['webhook_secret'] ?? env('CINETPAY_WEBHOOK_SECRET', '') ?? $this->secret);
        $baseUrl = rtrim((string) ($config['base_url'] ?? env('CINETPAY_BASE_URL', 'https://api-checkout.cinetpay.com/v2')), '/');

        // Many deployments mistakenly configure CINETPAY_BASE_URL as the backoffice URL.
        // The payment API endpoint is the checkout API.
        if (str_contains($baseUrl, 'client.cinetpay.com/v1')) {
            $baseUrl = 'https://api-checkout.cinetpay.com/v2';
        }

        $this->baseUrl = $baseUrl;
        $this->timeout = (int) ($config['timeout'] ?? 15);
        $this->defaultCurrency = strtoupper((string) ($config['default_currency'] ?? 'XOF'));
        $this->defaultChannels = (string) ($config['default_channels'] ?? 'MOBILE_MONEY');
    }

    public function initPayment(Order $order, User $user, array $meta = []): array
    {
        if (!$this->apiKey || !$this->siteId) {
            $missing = [];
            if (!$this->apiKey) {
                $missing[] = 'CINETPAY_API_KEY';
            }
            if (!$this->siteId) {
                $missing[] = 'CINETPAY_SITE_ID';
            }

            throw new \RuntimeException('CinetPay not configured (missing: ' . implode(', ', $missing) . ')');
        }

        $transactionId = $meta['transaction_id'] ?? $this->generateTransactionId($order);
        $amount = (float) ($meta['amount'] ?? $order->total_price);
        $currency = strtoupper($meta['currency'] ?? $this->defaultCurrency);

        $payload = [
            'apikey' => $this->apiKey,
            'site_id' => $this->siteId,
            'transaction_id' => $transactionId,
            'amount' => number_format($amount, 2, '.', ''),
            'currency' => $currency,
            'description' => $meta['description'] ?? sprintf('BADBOYSHOP Order #%s', $order->reference ?? $order->id),
            'customer_name' => $meta['customer_name'] ?? trim($user->name ?? $user->username ?? 'Client'),
            'customer_email' => $meta['customer_email'] ?? $user->email,
            'customer_phone_number' => $meta['customer_phone'] ?? Arr::get($order->meta ?? [], 'phone'),
            'notify_url' => $meta['notify_url'] ?? route('api.payments.cinetpay.webhook'),
            'return_url' => $meta['return_url'] ?? config('cinetpay.return_url'),
            'cancel_url' => $meta['cancel_url'] ?? config('cinetpay.cancel_url'),
            'channels' => $meta['channels'] ?? $this->defaultChannels,
            'lang' => $meta['lang'] ?? 'fr',
        ];

        if (!empty($meta['metadata'])) {
            // CinetPay expects metadata to be a string.
            $payload['metadata'] = $this->stringifyMetadata($meta['metadata']);
        }

        $payload = array_filter($payload, static fn ($value) => !is_null($value));

        Log::info('cinetpay:init', [
            'order_id' => $order->id,
            'transaction_id' => $transactionId,
            'payload' => Arr::except($payload, ['apikey']),
        ]);

        $response = $this->http()->post($this->endpoint('payment'), $payload);

        if (!$response->successful()) {
            Log::error('cinetpay:error', [
                'stage' => 'init',
                'order_id' => $order->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('CinetPay API request failed');
        }

        $data = $response->json();
        $code = $data['code'] ?? null;

        if (!in_array($code, ['00', '201'], true)) {
            Log::error('cinetpay:error', [
                'stage' => 'init',
                'order_id' => $order->id,
                'code' => $code,
                'message' => $data['message'] ?? 'unknown',
            ]);

            throw new \RuntimeException('CinetPay API error: ' . ($data['message'] ?? 'unknown'));
        }

        $paymentUrl = Arr::get($data, 'data.payment_url');

        if (!$paymentUrl) {
            Log::error('cinetpay:error', [
                'stage' => 'init',
                'order_id' => $order->id,
                'response' => $data,
            ]);

            throw new \RuntimeException('CinetPay did not return a payment link');
        }

        return [
            'transaction_id' => $transactionId,
            'payment_url' => $paymentUrl,
            'payment_token' => Arr::get($data, 'data.payment_token'),
            'raw' => $data,
        ];
    }

    private function stringifyMetadata(mixed $metadata): ?string
    {
        if (is_null($metadata)) {
            return null;
        }

        if (is_string($metadata)) {
            $trimmed = trim($metadata);
            return $trimmed === '' ? null : $trimmed;
        }

        if (is_scalar($metadata)) {
            $value = trim((string) $metadata);
            return $value === '' ? null : $value;
        }

        try {
            $encoded = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (!is_string($encoded) || $encoded === 'null') {
                return null;
            }

            return $encoded;
        } catch (\Throwable) {
            return null;
        }
    }

    public function verifyTransaction(string $transactionId): array
    {
        $payload = [
            'apikey' => $this->apiKey,
            'site_id' => $this->siteId,
            'transaction_id' => $transactionId,
        ];

        Log::info('cinetpay:verify', ['transaction_id' => $transactionId]);

        $response = $this->http()->post($this->endpoint('payment/check'), $payload);

        if (!$response->successful()) {
            Log::error('cinetpay:error', [
                'stage' => 'verify',
                'transaction_id' => $transactionId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('CinetPay verification failed');
        }

        return $response->json();
    }

    public function verifyWebhookSignature(array $payload): bool
    {
        if (empty($this->webhookSecret)) {
            return false;
        }

        $signature = $payload['signature']
            ?? $payload['cpm_signature']
            ?? $payload['cpm_trans_signature']
            ?? null;

        if (!$signature) {
            return false;
        }

        $signatureString = implode('', [
            $payload['cpm_trans_id'] ?? '',
            $payload['cpm_amount'] ?? '',
            $payload['cpm_currency'] ?? '',
            $payload['cpm_site_id'] ?? ($payload['site_id'] ?? ''),
        ]);

        $expected = hash_hmac('sha256', $signatureString, $this->webhookSecret);

        return hash_equals($expected, $signature);
    }

    public function normalizeStatus(array $payload, ?string $fallback = null): string
    {
        $candidates = array_filter(array_map(function ($value) {
            return $value ? strtoupper((string) $value) : null;
        }, [
            Arr::get($payload, 'data.status'),
            Arr::get($payload, 'data.payment_status'),
            Arr::get($payload, 'data.cpm_trans_status'),
            $fallback,
        ]));

        $paidStatuses = ['ACCEPTED', 'SUCCESS', 'PAID', 'APPROVED', 'COMPLETED'];
        $failedStatuses = ['REFUSED', 'FAILED', 'CANCELED', 'CANCELLED', 'ERROR', 'EXPIRED'];

        foreach ($candidates as $candidate) {
            if (in_array($candidate, $paidStatuses, true)) {
                return 'completed';
            }

            if (in_array($candidate, $failedStatuses, true)) {
                return 'failed';
            }
        }

        return 'pending';
    }

    public function generateTransactionId(Order $order): string
    {
        return sprintf('BB-%s-%s', $order->id, strtoupper(Str::random(10)));
    }

    private function http(): PendingRequest
    {
        return Http::timeout($this->timeout)
            ->acceptJson()
            ->asJson();
    }

    private function endpoint(string $path): string
    {
        return $this->baseUrl . '/' . ltrim($path, '/');
    }
}
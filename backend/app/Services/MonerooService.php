<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;

class MonerooService
{
    private const SUPPORTED_PAYOUT_COUNTRIES = [
        'BJ' => [
            'label' => 'Benin',
            'methods' => [
                ['value' => 'mtn_bj', 'aliases' => ['mtn']],
                ['value' => 'moov_bj', 'aliases' => ['moov']],
            ],
        ],
        'TG' => [
            'label' => 'Togo',
            'methods' => [
                ['value' => 'moov_tg', 'aliases' => []],
                ['value' => 'togocel', 'aliases' => []],
            ],
        ],
        'CI' => [
            'label' => 'Cote d\'Ivoire',
            'methods' => [
                ['value' => 'mtn_ci', 'aliases' => []],
                ['value' => 'moov_ci', 'aliases' => []],
                ['value' => 'orange_ci', 'aliases' => []],
                ['value' => 'wave_ci', 'aliases' => []],
                ['value' => 'djamo_ci', 'aliases' => []],
            ],
        ],
        'SN' => [
            'label' => 'Senegal',
            'methods' => [
                ['value' => 'freemoney_sn', 'aliases' => ['free_sn']],
                ['value' => 'orange_sn', 'aliases' => []],
                ['value' => 'wave_sn', 'aliases' => []],
                ['value' => 'e_money_sn', 'aliases' => []],
                ['value' => 'wizall_sn', 'aliases' => []],
                ['value' => 'djamo_sn', 'aliases' => []],
            ],
        ],
        'NE' => [
            'label' => 'Niger',
            'methods' => [
                ['value' => 'airtel_ne', 'aliases' => []],
            ],
        ],
    ];

    private string $secretKey;
    private string $publicKey;
    private string $webhookSecret;
    private string $baseUrl;
    private int $timeout;
    private string $defaultCurrency;
    private ?string $defaultReturnUrl;
    private ?string $payoutReturnUrl;
    private bool $enabled;

    public function __construct()
    {
        $config = config('moneroo');

        $this->secretKey = trim((string) ($config['secret_key'] ?? ''));
        $this->publicKey = trim((string) ($config['public_key'] ?? ''));
        $this->webhookSecret = trim((string) ($config['webhook_secret'] ?? ''));
        $this->baseUrl = rtrim((string) ($config['base_url'] ?? 'https://api.moneroo.io/v1'), '/');
        $this->timeout = max(5, (int) ($config['timeout'] ?? 30));
        $this->defaultCurrency = strtoupper(trim((string) ($config['default_currency'] ?? 'XOF'))) ?: 'XOF';
        $this->defaultReturnUrl = $config['return_url'] ?? null;
        $this->payoutReturnUrl = $config['payout_return_url'] ?? null;
        $this->enabled = (bool) ($config['enabled'] ?? true);
    }

    public function isConfigured(): bool
    {
        return $this->enabled && $this->secretKey !== '';
    }

    public function defaultReturnUrl(): ?string
    {
        return $this->defaultReturnUrl;
    }

    public function initPayment(Order $order, User $user, array $options = []): array
    {
        $this->assertConfigured();

        $amount = max(1, (int) round((float) ($options['amount'] ?? $order->total_price ?? 0)));
        $currency = $this->sanitizeCurrency($options['currency'] ?? $this->defaultCurrency);
        $returnUrl = trim((string) ($options['return_url'] ?? $this->defaultReturnUrl ?? ''));
        if ($returnUrl === '') {
            throw new \RuntimeException('Moneroo return URL is not configured.');
        }

        $payload = [
            'amount' => $amount,
            'currency' => $currency,
            'description' => $this->paymentDescription($order, $options),
            'return_url' => $returnUrl,
            'customer' => $this->buildCustomerPayload($user, $options),
            'metadata' => $this->stringifyMetadata(array_merge([
                'order_id' => (string) $order->id,
                'reference' => (string) ($order->reference ?? $order->id),
                'user_id' => (string) ($user->id ?? ''),
            ], Arr::wrap($options['metadata'] ?? []))),
        ];

        $methods = array_values(array_filter(array_map(static fn ($value) => trim((string) $value), Arr::wrap($options['methods'] ?? []))));
        if ($methods !== []) {
            $payload['methods'] = $methods;
        }

        if (!empty($options['restrict_country_code'])) {
            $payload['restrict_country_code'] = strtoupper(trim((string) $options['restrict_country_code']));
        }

        if (!empty($options['restricted_phone']) && is_array($options['restricted_phone'])) {
            $payload['restricted_phone'] = array_filter([
                'number' => trim((string) ($options['restricted_phone']['number'] ?? '')),
                'country_code' => strtoupper(trim((string) ($options['restricted_phone']['country_code'] ?? ''))),
            ]);
        }

        $data = $this->request('post', '/payments/initialize', $payload);

        return [
            'transaction_id' => $this->extractId($data),
            'payment_url' => trim((string) ($data['checkout_url'] ?? '')),
            'provider_amount' => $amount,
            'provider_currency' => $currency,
            'raw' => $data,
        ];
    }

    public function verifyPayment(string $paymentId): array
    {
        $this->assertConfigured();
        return $this->request('get', '/payments/' . rawurlencode($paymentId) . '/verify');
    }

    public function retrievePayment(string $paymentId): array
    {
        $this->assertConfigured();
        return $this->request('get', '/payments/' . rawurlencode($paymentId));
    }

    public function initPayout(User $user, array $options = []): array
    {
        $this->assertConfigured();

        $amount = max(1, (int) round((float) ($options['amount'] ?? 0)));
        $currency = $this->sanitizeCurrency($options['currency'] ?? $this->defaultCurrency);
        $method = $this->resolvePayoutMethodCode(
            (string) ($options['method'] ?? ''),
            (string) ($options['country'] ?? '')
        );
        if ($method === '') {
            throw new \RuntimeException('Moneroo payout method is missing or unsupported.');
        }

        $recipientValue = preg_replace('/\D+/', '', (string) ($options['recipient_value'] ?? '')) ?? '';
        if ($recipientValue === '') {
            throw new \RuntimeException('Moneroo payout recipient is missing.');
        }

        $returnUrl = trim((string) ($options['return_url'] ?? $this->payoutReturnUrl ?? $this->defaultReturnUrl ?? ''));
        if ($returnUrl === '') {
            throw new \RuntimeException('Moneroo payout return URL is not configured.');
        }

        $payload = [
            'amount' => $amount,
            'currency' => $currency,
            'description' => trim((string) ($options['description'] ?? ('Wallet withdrawal #' . ($options['reference'] ?? '')))),
            'return_url' => $returnUrl,
            'method' => $method,
            'customer' => $this->buildCustomerPayload($user, $options),
            'recipient' => $this->buildPayoutRecipient($method, $recipientValue),
            'metadata' => $this->stringifyMetadata(array_merge([
                'user_id' => (string) $user->id,
                'reference' => (string) ($options['reference'] ?? ''),
                'payout_id' => (string) ($options['payout_id'] ?? ''),
            ], Arr::wrap($options['metadata'] ?? []))),
        ];

        if (array_key_exists('request_confirmation', $options)) {
            $payload['request_confirmation'] = (bool) $options['request_confirmation'];
        }

        $data = $this->request('post', '/payouts/initialize', $payload);

        return [
            'transaction_id' => $this->extractId($data),
            'raw' => $data,
        ];
    }

    public function verifyPayout(string $payoutId): array
    {
        $this->assertConfigured();
        return $this->request('get', '/payouts/' . rawurlencode($payoutId) . '/verify');
    }

    public function retrievePayout(string $payoutId): array
    {
        $this->assertConfigured();
        return $this->request('get', '/payouts/' . rawurlencode($payoutId));
    }

    public function normalizePaymentStatus(array $payload, ?string $fallback = null): string
    {
        $status = strtolower(trim((string) (
            Arr::get($payload, 'status')
            ?? Arr::get($payload, 'data.status')
            ?? $fallback
            ?? ''
        )));

        return match ($status) {
            'success' => 'completed',
            'failed', 'cancelled' => 'failed',
            'initiated', 'pending' => 'pending',
            default => 'pending',
        };
    }

    public function normalizePayoutStatus(array $payload, ?string $fallback = null): string
    {
        $status = strtolower(trim((string) (
            Arr::get($payload, 'status')
            ?? Arr::get($payload, 'data.status')
            ?? $fallback
            ?? ''
        )));

        return match ($status) {
            'success' => 'sent',
            'failed', 'cancelled' => 'failed',
            'initiated', 'pending' => 'processing',
            default => 'processing',
        };
    }

    public function verifyWebhookSignature(string $rawBody, ?string $signatureHeader, ?string $secret = null): bool
    {
        $signingSecret = trim((string) ($secret ?? $this->webhookSecret));
        $received = trim((string) ($signatureHeader ?? ''));

        if ($signingSecret === '' || $received === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $rawBody, $signingSecret);

        return hash_equals(strtolower($expected), strtolower($received));
    }

    public function extractId(array $payload): string
    {
        return trim((string) (
            Arr::get($payload, 'id')
            ?? Arr::get($payload, 'data.id')
            ?? ''
        ));
    }

    public function extractCurrencyCode(array $payload): string
    {
        $code = trim((string) (
            Arr::get($payload, 'currency.code')
            ?? Arr::get($payload, 'currency')
            ?? Arr::get($payload, 'data.currency.code')
            ?? Arr::get($payload, 'data.currency')
            ?? $this->defaultCurrency
        ));

        return strtoupper($code ?: $this->defaultCurrency);
    }

    public function payoutSupport(): array
    {
        return [
            'configured_modes' => collect(self::SUPPORTED_PAYOUT_COUNTRIES)
                ->flatMap(static fn (array $entry) => array_map(static fn (array $method) => $method['value'], $entry['methods']))
                ->values()
                ->all(),
            'countries' => collect(self::SUPPORTED_PAYOUT_COUNTRIES)
                ->map(static fn (array $entry, string $code) => [
                    'code' => $code,
                    'label' => $entry['label'],
                    'methods' => array_map(static fn (array $method) => [
                        'value' => $method['value'],
                        'resolved_mode' => $method['value'],
                        'enabled' => true,
                        'aliases' => $method['aliases'],
                    ], $entry['methods']),
                ])
                ->values()
                ->all(),
        ];
    }

    public function resolvePayoutMethodCode(string $method, string $country): string
    {
        $normalizedMethod = strtolower(trim($method));
        $normalizedCountry = strtoupper(trim($country));

        foreach (self::SUPPORTED_PAYOUT_COUNTRIES[$normalizedCountry]['methods'] ?? [] as $candidate) {
            if ($candidate['value'] === $normalizedMethod || in_array($normalizedMethod, $candidate['aliases'], true)) {
                return $candidate['value'];
            }
        }

        return $normalizedMethod;
    }

    private function paymentDescription(Order $order, array $options): string
    {
        $description = trim((string) ($options['description'] ?? ''));
        if ($description !== '') {
            return $description;
        }

        return sprintf('Paiement commande #%s', (string) ($order->reference ?? $order->id));
    }

    private function buildCustomerPayload(User $user, array $options = []): array
    {
        $fullName = trim((string) ($user->name ?? ''));
        $parts = $fullName !== '' ? preg_split('/\s+/', $fullName) : [];

        $firstName = trim((string) ($options['customer_first_name'] ?? $user->first_name ?? ($parts[0] ?? 'Client')));
        $lastName = trim((string) ($options['customer_last_name'] ?? $user->last_name ?? (isset($parts[1]) ? implode(' ', array_slice($parts, 1)) : '')));
        $email = trim((string) ($options['customer_email'] ?? $user->email ?? ''));
        if ($email === '') {
            throw new \RuntimeException('Moneroo requires a customer email address.');
        }

        return array_filter([
            'email' => $email,
            'first_name' => $firstName !== '' ? $firstName : 'Client',
            'last_name' => $lastName,
            'phone' => $this->sanitizePhone((string) ($options['customer_phone'] ?? $user->phone ?? '')),
            'address' => trim((string) ($options['customer_address'] ?? '')),
            'city' => trim((string) ($options['customer_city'] ?? '')),
            'state' => trim((string) ($options['customer_state'] ?? '')),
            'country' => strtoupper(trim((string) ($options['customer_country'] ?? $user->country_code ?? ''))),
            'zip' => trim((string) ($options['customer_zip'] ?? '')),
        ], static fn ($value) => $value !== null && $value !== '');
    }

    private function buildPayoutRecipient(string $method, string $recipientValue): array
    {
        if ($method === 'moneroo_payout_demo') {
            return ['account_number' => $recipientValue];
        }

        return ['msisdn' => $recipientValue];
    }

    private function stringifyMetadata(array $metadata): array
    {
        $normalized = [];

        foreach ($metadata as $key => $value) {
            if ($value === null) {
                continue;
            }

            if (is_scalar($value)) {
                $normalized[(string) $key] = (string) $value;
                continue;
            }

            $normalized[(string) $key] = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return $normalized;
    }

    private function sanitizeCurrency(mixed $currency): string
    {
        $normalized = strtoupper(trim((string) $currency));
        return $normalized !== '' ? $normalized : $this->defaultCurrency;
    }

    private function sanitizePhone(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '' || preg_match('/^0+$/', $digits) || strlen($digits) < 6) {
            return null;
        }

        return $digits;
    }

    private function request(string $method, string $endpoint, array $payload = []): array
    {
        $response = $this->client()->send(strtoupper($method), ltrim($endpoint, '/'), [
            'json' => $payload,
        ]);

        $decoded = $response->json();
        if (!is_array($decoded)) {
            throw new \RuntimeException('Moneroo API returned a non-JSON response.');
        }

        if (!$response->successful()) {
            $message = trim((string) ($decoded['message'] ?? 'Moneroo API request failed.'));
            throw new \RuntimeException($message, $response->status());
        }

        $data = $decoded['data'] ?? [];

        return is_array($data) ? $data : [];
    }

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->timeout($this->timeout)
            ->withToken($this->secretKey)
            ->baseUrl($this->baseUrl)
            ->withHeaders([
                'User-Agent' => 'PRIME Gaming Moneroo Integration',
            ]);
    }

    private function assertConfigured(): void
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Moneroo not configured (missing: MONEROO_SECRET_KEY).');
        }
    }
}
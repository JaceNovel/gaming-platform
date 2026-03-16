<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FedaPayService
{
    private const SUPPORTED_PAYOUT_COUNTRIES = [
        'BJ' => [
            'label' => 'Benin',
            'methods' => ['mtn', 'moov', 'bestcash', 'celtiis', 'coris_money', 'bank'],
        ],
        'TG' => [
            'label' => 'Togo',
            'methods' => ['moov_tg', 'togocel', 'bank'],
        ],
        'CI' => [
            'label' => 'Cote d\'Ivoire',
            'methods' => ['mtn_ci', 'bank'],
        ],
        'SN' => [
            'label' => 'Senegal',
            'methods' => ['free_sn', 'bank'],
        ],
        'NE' => [
            'label' => 'Niger',
            'methods' => ['airtel_ne', 'bank'],
        ],
    ];

    private string $secretKey;
    private string $environment;
    private string $baseUrl;
    private int $timeout;
    private string $defaultCurrency;
    private ?string $defaultCallbackUrl;
    private ?string $webhookSecret;
    private int $webhookTolerance;
    private array $currencyIds;
    private array $payoutBalanceIds;

    public function __construct()
    {
        $config = config('fedapay');

        $this->secretKey = (string) ($config['secret_key'] ?? env('FEDAPAY_SECRET_KEY', ''));
        $this->environment = strtolower((string) ($config['environment'] ?? env('FEDAPAY_ENV', 'sandbox')));
        $this->timeout = (int) ($config['timeout'] ?? env('FEDAPAY_TIMEOUT', 15));
        $this->defaultCurrency = strtoupper((string) ($config['default_currency'] ?? env('FEDAPAY_DEFAULT_CURRENCY', 'XOF')));
        $this->defaultCallbackUrl = $config['callback_url'] ?? env('FEDAPAY_CALLBACK_URL');
        $this->webhookSecret = (string) ($config['webhook_secret'] ?? env('FEDAPAY_WEBHOOK_SECRET', ''));
        $this->webhookTolerance = (int) ($config['webhook_tolerance'] ?? env('FEDAPAY_WEBHOOK_TOLERANCE', 300));
        $this->currencyIds = is_array($config['currency_ids'] ?? null) ? $config['currency_ids'] : [];
        $this->payoutBalanceIds = is_array($config['payout_balance_ids'] ?? null) ? $config['payout_balance_ids'] : [];

        $override = (string) ($config['base_url'] ?? env('FEDAPAY_BASE_URL', ''));
        if ($override !== '') {
            $this->baseUrl = rtrim($override, '/');
        } else {
            $host = $this->environment === 'live' ? 'https://api.fedapay.com' : 'https://sandbox-api.fedapay.com';
            $this->baseUrl = rtrim($host . '/v1', '/');
        }
    }

    /**
     * Verify webhook signature from header X-FEDAPAY-SIGNATURE.
     */
    public function verifyWebhookSignature(string $rawBody, ?string $signatureHeader): bool
    {
        $secret = trim((string) $this->webhookSecret);
        $sigHeader = trim((string) ($signatureHeader ?? ''));

        if ($secret === '' || $sigHeader === '') {
            return false;
        }

        [$sig, $format] = $this->extractSignature($sigHeader);
        if ($sig === '') {
            return false;
        }

        $expectedHex = hash_hmac('sha256', $rawBody, $secret);
        $expectedB64 = base64_encode(hash_hmac('sha256', $rawBody, $secret, true));

        // Compare in constant-time.
        return hash_equals($expectedHex, $sig)
            || hash_equals($expectedHex, strtolower($sig))
            || hash_equals($expectedB64, $sig)
            || hash_equals($expectedB64, strtolower($sig));
    }

    /**
     * @return array{0:string,1:string} [signature, format]
     */
    private function extractSignature(string $sigHeader): array
    {
        $header = trim($sigHeader);
        if ($header === '') {
            return ['', 'missing'];
        }

        if (stripos($header, 'v1=') !== false) {
            if (preg_match('/(?:^|[\s,;])v1\s*=\s*([^,;\s]+)/i', $header, $m)) {
                $sig = trim((string) $m[1]);
                $sig = trim($sig, " \t\n\r\0\x0B\"'");
                return [$sig, 'v1'];
            }
        }

        if (stripos($header, 'sha256=') !== false) {
            if (preg_match('/(?:^|[\s,;])sha256\s*=\s*([^,;\s]+)/i', $header, $m)) {
                $sig = trim((string) $m[1]);
                $sig = trim($sig, " \t\n\r\0\x0B\"'");
                return [$sig, 'sha256'];
            }
        }

        $sig = trim($header, " \t\n\r\0\x0B\"'");
        return [$sig, 'raw'];
    }

    public function initPayment(Order $order, User $user, array $meta = []): array
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        $amount = (float) ($meta['amount'] ?? $order->total_price);
        $amountInt = (int) round($amount);
        $currency = $this->sanitizeCurrency($meta['currency'] ?? $this->defaultCurrency);

        $description = (string) ($meta['description'] ?? sprintf('PRIME Gaming Order #%s', $order->reference ?? $order->id));
        $callbackUrl = (string) ($meta['callback_url'] ?? $this->defaultCallbackUrl ?? '');

        $customer = $meta['customer'] ?? null;
        if (!is_array($customer)) {
            $fullName = trim((string) ($user->name ?? ''));
            $parts = $fullName !== '' ? preg_split('/\s+/', $fullName) : [];
            $firstname = (string) ($user->first_name ?? ($parts[0] ?? 'Client'));
            $lastname = (string) ($user->last_name ?? (isset($parts[1]) ? implode(' ', array_slice($parts, 1)) : ''));

            $customer = array_filter([
                'firstname' => $firstname,
                'lastname' => $lastname,
                'email' => (string) ($meta['customer_email'] ?? $user->email ?? ''),
            ], static fn ($v) => $v !== null && $v !== '');

            $phone = trim((string) ($meta['customer_phone'] ?? ''));
            $digits = preg_replace('/\D+/', '', $phone) ?? '';
            $allZeros = $digits !== '' && preg_match('/^0+$/', $digits);
            if ($digits !== '' && !$allZeros && strlen($digits) >= 6) {
                // FedaPay examples accept phone_number.number and phone_number.country.
                // If you already store international format (+229...), pass it in number.
                $customer['phone_number'] = [
                    // FedaPay is strict about formatting; send digits only.
                    'number' => $digits,
                    'country' => strtolower((string) ($meta['customer_country'] ?? 'BJ')),
                ];
            }
        }

        $customerNoPhone = $customer;
        if (is_array($customerNoPhone)) {
            unset($customerNoPhone['phone_number']);
        }

        $basePayload = [
            'description' => $description,
            'amount' => $amountInt,
            'callback_url' => $callbackUrl !== '' ? $callbackUrl : null,
            'customer' => $customer,
            'merchant_reference' => (string) ($meta['merchant_reference'] ?? $order->reference ?? ''),
            'custom_metadata' => $meta['metadata'] ?? [
                'order_id' => $order->id,
                'user_id' => $order->user_id,
            ],
        ];

        // FedaPay payload formats vary depending on API version/integration.
        // Try a few known shapes (currency object vs string).
        $payloadPrimary = array_filter($basePayload + [
            'currency' => ['iso' => $currency],
        ], static fn ($v) => $v !== null);

        $payloadCurrencyString = array_filter($basePayload + [
            'currency' => $currency,
        ], static fn ($v) => $v !== null);

        $payloadCurrencyIsoString = array_filter($basePayload + [
            'currency' => ['iso' => (string) $currency],
        ], static fn ($v) => $v !== null);

        // Fallbacks without phone_number (some FedaPay accounts enforce strict phone formats).
        $payloadPrimaryNoPhone = $payloadPrimary;
        $payloadCurrencyStringNoPhone = $payloadCurrencyString;
        $payloadCurrencyIsoStringNoPhone = $payloadCurrencyIsoString;
        $payloadPrimaryNoPhone['customer'] = $customerNoPhone;
        $payloadCurrencyStringNoPhone['customer'] = $customerNoPhone;
        $payloadCurrencyIsoStringNoPhone['customer'] = $customerNoPhone;

        Log::info('fedapay:init', [
            'order_id' => $order->id,
            'amount' => $amountInt,
            'currency' => $currency,
            'callback_url' => $callbackUrl,
        ]);

        $created = $this->postWithFallback($this->endpoint('/transactions'), $payloadPrimary, [
            // Some JSON APIs expect a root "transaction" object.
            ['transaction' => $payloadPrimary],

            // If phone validation fails, retry without phone.
            $payloadPrimaryNoPhone,
            ['transaction' => $payloadPrimaryNoPhone],

            // Currency as plain string.
            $payloadCurrencyString,
            ['transaction' => $payloadCurrencyString],

            $payloadCurrencyStringNoPhone,
            ['transaction' => $payloadCurrencyStringNoPhone],

            // Some APIs accept currency as {iso: "XOF"} but are picky about type.
            $payloadCurrencyIsoString,
            ['transaction' => $payloadCurrencyIsoString],

            $payloadCurrencyIsoStringNoPhone,
            ['transaction' => $payloadCurrencyIsoStringNoPhone],
        ]);

        $transactionId = Arr::get($created, 'id')
            ?? Arr::get($created, 'data.id')
            ?? Arr::get($created, 'transaction.id')
            ?? Arr::get($created, 'data.transaction.id')
            // Some responses use a literal key with a slash: {"v1/transaction": {"id": ...}}
            ?? Arr::get($created, 'v1/transaction.id')
            ?? Arr::get($created, 'data.v1/transaction.id')
            // Other responses wrap it as {"v1": {"transaction": {"id": ...}}}
            ?? Arr::get($created, 'v1.transaction.id')
            ?? Arr::get($created, 'data.v1.transaction.id');

        if (!$transactionId) {
            // Sometimes providers return HTTP 200 with an error payload.
            $snippet = mb_substr(json_encode($created, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '', 0, 1600);
            Log::error('fedapay:error', ['stage' => 'create-transaction', 'response' => $snippet]);
            throw new \RuntimeException('FedaPay did not return a transaction id. Response: ' . $snippet);
        }

        // Some providers already return a payment_url / payment_token in the transaction payload.
        // Prefer it to avoid an extra API call and mismatched schemas.
        $paymentUrl = $this->findFirstUrl($created);
        $tokenResp = null;

        if (!$paymentUrl) {
            $tokenResp = $this->postJson($this->endpoint('/transactions/' . $transactionId . '/token'), []);
            $paymentUrl = $this->findFirstUrl($tokenResp);
        }

        if (!$paymentUrl) {
            Log::error('fedapay:error', [
                'stage' => 'token',
                'transaction_id' => $transactionId,
                'response' => $tokenResp,
                'create_response' => mb_substr(json_encode($created, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '', 0, 1200),
            ]);
            throw new \RuntimeException('FedaPay did not return a payment link');
        }

        return [
            'transaction_id' => (string) $transactionId,
            'payment_url' => $paymentUrl,
            'raw' => [
                'transaction' => $created,
                'token' => $tokenResp,
            ],
        ];
    }

    public function retrieveTransaction(string $transactionId): array
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        Log::info('fedapay:retrieve', ['transaction_id' => $transactionId]);

        return $this->getJson($this->endpoint('/transactions/' . $transactionId));
    }

    public function createPayout(User $user, array $payload = []): array
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        $amountInt = (int) round((float) ($payload['amount'] ?? 0));
        if ($amountInt <= 0) {
            throw new \RuntimeException('FedaPay payout amount must be greater than zero');
        }

        $currency = $this->sanitizeCurrency($payload['currency'] ?? $this->defaultCurrency);
        $countryCode = strtoupper(trim((string) ($payload['customer_country'] ?? 'BJ')));
        $mode = $this->resolvePayoutMode((string) ($payload['mode'] ?? 'mobile_money'), $countryCode);

        $customer = $payload['customer'] ?? null;
        if (!is_array($customer)) {
            $fullName = trim((string) ($payload['customer_name'] ?? $user->name ?? 'Client PRIME'));
            $parts = $fullName !== '' ? preg_split('/\s+/', $fullName) : [];
            $firstname = (string) ($user->first_name ?? ($parts[0] ?? 'Client'));
            $lastname = (string) ($user->last_name ?? (isset($parts[1]) ? implode(' ', array_slice($parts, 1)) : ''));
            $customer = array_filter([
                'firstname' => $firstname,
                'lastname' => $lastname,
                'email' => (string) ($payload['customer_email'] ?? $user->email ?? ''),
            ], static fn ($value) => $value !== null && $value !== '');

            $phone = trim((string) ($payload['customer_phone'] ?? ''));
            $digits = preg_replace('/\D+/', '', $phone) ?? '';
            if ($digits !== '' && strlen($digits) >= 6) {
                $customer['phone_number'] = [
                    'number' => $digits,
                    'country' => strtolower($countryCode),
                ];
            }
        }

        $account = $this->retrieveAccountProfile();
        $currencyId = $this->resolveCurrencyId($currency, $account);
        $balanceMatch = $this->resolveBalance($mode, $account);
        $balanceId = $balanceMatch['id'] ?? null;
        $resolvedMode = $balanceMatch['mode'] ?? $mode;

        if (!$balanceId) {
            throw new \RuntimeException(sprintf(
                'FedaPay payout balance not configured for mode "%s". Configure FEDAPAY_PAYOUT_BALANCE_IDS or verify the account balances API.',
                $mode
            ));
        }

        $basePayload = array_filter([
            'amount' => $amountInt,
            'balance_id' => $balanceId,
            'customer' => $customer,
            'mode' => $resolvedMode,
            'metadata' => is_array($payload['metadata'] ?? null) ? $payload['metadata'] : null,
            'custom_metadata' => is_array($payload['custom_metadata'] ?? null) ? $payload['custom_metadata'] : null,
            'merchant_reference' => (string) ($payload['merchant_reference'] ?? ''),
        ], static fn ($value) => $value !== null && $value !== '');

        $payloadWithCurrencyCode = array_merge($basePayload, ['currency' => ['iso' => $currency]]);
        $payloadWithCurrencyString = array_merge($basePayload, ['currency' => $currency]);
        $payloadWithCurrencyAndBalance = array_merge($payloadWithCurrencyString, ['balance' => $balanceId]);

        $fallbacks = [
            ['payout' => $payloadWithCurrencyCode],
            $payloadWithCurrencyString,
            ['payout' => $payloadWithCurrencyString],
            $payloadWithCurrencyAndBalance,
            ['payout' => $payloadWithCurrencyAndBalance],
        ];

        if ($currencyId) {
            $payloadWithCurrencyId = array_merge($basePayload, ['currency_id' => $currencyId]);
            $payloadWithCurrencyScalar = array_merge($basePayload, ['currency' => $currencyId]);

            array_unshift(
                $fallbacks,
                ['payout' => $payloadWithCurrencyId],
                $payloadWithCurrencyId,
                ['payout' => $payloadWithCurrencyScalar],
                $payloadWithCurrencyScalar
            );
        }

        return $this->postWithFallback($this->endpoint('/payouts'), $payloadWithCurrencyCode, $fallbacks);
    }

    public function resolvePayoutMode(string $requestedMode, ?string $country = null): string
    {
        $method = strtolower(trim($requestedMode));
        $countryCode = strtoupper(trim((string) $country));

        $mapped = match ($method) {
            'orange_money' => match ($countryCode) {
                'BF' => 'orange_bf',
                'ML' => 'orange_ml',
                'SN' => 'orange_sn',
                default => 'orange_ci',
            },
            'mtn_mobile_money' => match ($countryCode) {
                'CI' => 'mtn_ci',
                default => 'mtn',
            },
            'mtn_ci', 'mtn' => match ($countryCode) {
                'CI' => 'mtn_ci',
                default => 'mtn',
            },
            'moov_money' => match ($countryCode) {
                'TG' => 'moov_tg',
                'BF' => 'moov_bf',
                'CI' => 'moov_ci',
                default => 'moov',
            },
            'moov_tg' => 'moov_tg',
            'moov_ci' => 'moov_ci',
            'moov_bf' => 'moov_bf',
            'moov' => 'moov',
            'wave' => match ($countryCode) {
                'SN' => 'wave_sn',
                default => 'wave_ci',
            },
            'bestcash', 'bestcash_money' => 'bestcash',
            'celtiis', 'celtiis_cash' => 'celtiis',
            'coris', 'coris_money' => 'coris_money',
            'free', 'free_senegal', 'free_sn' => 'free_sn',
            'airtel', 'airtel_niger', 'airtel_ne' => 'airtel_ne',
            'togocel_tmoney' => 'togocel',
            'bank', 'bank_transfer' => 'bank_transfer',
            'mobile_money', '' => match ($countryCode) {
                'TG' => 'togocel',
                'SN' => 'wave_sn',
                'BF' => 'moov_bf',
                'ML' => 'orange_ml',
                default => 'orange_ci',
            },
            default => $method,
        };

        return preg_match('/^[a-z0-9_]+$/', $mapped) ? $mapped : 'orange_ci';
    }

    public function retrievePayout(int|string $payoutId): array
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        return $this->getJson($this->endpoint('/payouts/' . $payoutId));
    }

    public function updatePayout(int|string $payoutId, array $payload): array
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        return $this->putJson($this->endpoint('/payouts/' . $payoutId), $payload);
    }

    public function deletePayout(int|string $payoutId): void
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        $this->deleteJson($this->endpoint('/payouts/' . $payoutId));
    }

    public function searchPayouts(array $query = []): array
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        return $this->getJson($this->endpoint('/payouts/search'), $query);
    }

    public function startPayout(array $items): array
    {
        if ($this->secretKey === '') {
            throw new \RuntimeException('FedaPay not configured (missing: FEDAPAY_SECRET_KEY)');
        }

        return $this->putJson($this->endpoint('/payouts/start'), $items);
    }

    public function extractPayoutId(array $payload): ?int
    {
        $id = Arr::get($payload, 'id')
            ?? Arr::get($payload, 'data.id')
            ?? Arr::get($payload, 'payout.id')
            ?? Arr::get($payload, 'data.payout.id');

        if (is_array($payload) && array_is_list($payload)) {
            $first = $payload[0] ?? null;
            if (is_array($first)) {
                $id = $id ?? Arr::get($first, 'id') ?? Arr::get($first, 'data.id');
            }
        }

        return is_numeric($id) ? (int) $id : null;
    }

    public function extractPayoutReference(array $payload): ?string
    {
        $reference = Arr::get($payload, 'reference')
            ?? Arr::get($payload, 'data.reference')
            ?? Arr::get($payload, 'payout.reference')
            ?? Arr::get($payload, 'data.payout.reference');

        if (is_array($payload) && array_is_list($payload)) {
            $first = $payload[0] ?? null;
            if (is_array($first)) {
                $reference = $reference ?? Arr::get($first, 'reference') ?? Arr::get($first, 'data.reference');
            }
        }

        return is_string($reference) && trim($reference) !== '' ? trim($reference) : null;
    }

    public function normalizeStatus(array $payload, ?string $fallback = null): string
    {
        $candidates = array_filter(array_map(function ($value) {
            return $value ? strtolower((string) $value) : null;
        }, [
            Arr::get($payload, 'status'),
            Arr::get($payload, 'transaction.status'),
            Arr::get($payload, 'data.status'),
            $fallback,
        ]));

        // FedaPay lifecycle: pending, approved, declined, canceled, refunded, transferred, expired
        foreach ($candidates as $status) {
            if (in_array($status, ['approved', 'completed', 'paid', 'success', 'transferred'], true)) {
                return 'completed';
            }
            if (in_array($status, ['declined', 'canceled', 'cancelled', 'expired', 'failed'], true)) {
                return 'failed';
            }
        }

        return 'pending';
    }

    public function normalizePayoutStatus(array $payload, ?string $fallback = null): string
    {
        $candidates = array_filter(array_map(function ($value) {
            return $value ? strtolower((string) $value) : null;
        }, [
            Arr::get($payload, 'status'),
            Arr::get($payload, 'data.status'),
            Arr::get($payload, 'payout.status'),
            is_array($payload) && array_is_list($payload) ? Arr::get($payload, '0.status') : null,
            $fallback,
        ]));

        foreach ($candidates as $status) {
            if (in_array($status, ['sent', 'completed', 'success', 'paid', 'transferred'], true)) {
                return 'sent';
            }
            if (in_array($status, ['failed', 'declined'], true)) {
                return 'failed';
            }
            if (in_array($status, ['cancelled', 'canceled', 'deleted'], true)) {
                return 'cancelled';
            }
            if (in_array($status, ['pending', 'scheduled', 'processing'], true)) {
                return 'processing';
            }
        }

        return 'processing';
    }

    public function payoutSupport(): array
    {
        $configuredModes = collect($this->payoutBalanceIds)
            ->filter(static fn ($value) => is_numeric($value))
            ->keys()
            ->map(static fn ($mode) => strtolower((string) $mode))
            ->values()
            ->all();

        $countries = [];
        foreach (self::SUPPORTED_PAYOUT_COUNTRIES as $code => $entry) {
            $methods = [];
            foreach ((array) ($entry['methods'] ?? []) as $method) {
                $resolvedMode = $this->resolvePayoutMode((string) $method, $code);
                $aliases = array_values(array_unique(array_merge([$method, $resolvedMode], $this->balanceModeCandidates($resolvedMode))));
                $enabled = count(array_intersect($configuredModes, $aliases)) > 0;

                $methods[] = [
                    'value' => $method,
                    'resolved_mode' => $resolvedMode,
                    'enabled' => $enabled,
                    'aliases' => $aliases,
                ];
            }

            $countries[] = [
                'code' => $code,
                'label' => (string) ($entry['label'] ?? $code),
                'methods' => $methods,
            ];
        }

        return [
            'configured_modes' => $configuredModes,
            'countries' => $countries,
        ];
    }

    private function endpoint(string $path): string
    {
        return rtrim($this->baseUrl, '/') . '/' . ltrim($path, '/');
    }

    private function http(): PendingRequest
    {
        return Http::timeout($this->timeout)
            ->acceptJson()
            ->asJson()
            ->withToken($this->secretKey);
    }

    private function requestJson(string $method, string $url, array $payload = [], bool $logErrors = true): array
    {
        $method = strtolower($method);
        $request = $this->http();

        if ($method === 'get') {
            $response = $request->get($url, $payload);
        } elseif ($method === 'delete') {
            $response = $request->send('DELETE', $url, ['json' => $payload]);
        } else {
            $response = $request->send(strtoupper($method), $url, ['json' => $payload]);
        }

        if (!$response->successful()) {
            $body = $response->body();
            $snippet = mb_substr((string) $body, 0, 1200);
            if ($logErrors) {
                Log::error('fedapay:error', [
                    'stage' => $method,
                    'url' => $url,
                    'status' => $response->status(),
                    'body' => $snippet,
                ]);
            }
            throw new \RuntimeException('FedaPay API request failed (HTTP ' . $response->status() . '): ' . $snippet, $response->status());
        }

        if ($response->status() === 204) {
            return [];
        }

        return (array) ($response->json() ?? []);
    }

    private function postJson(string $url, array $payload, bool $logErrors = true): array
    {
        return $this->requestJson('post', $url, $payload, $logErrors);
    }

    private function putJson(string $url, array $payload): array
    {
        return $this->requestJson('put', $url, $payload);
    }

    private function deleteJson(string $url, array $payload = []): array
    {
        return $this->requestJson('delete', $url, $payload);
    }

    private function getJson(string $url, array $query = []): array
    {
        return $this->requestJson('get', $url, $query);
    }

    private function postWithFallback(string $url, array $primary, array $fallbacks): array
    {
        try {
            return $this->postJson($url, $primary);
        } catch (\Throwable $e) {
            if ($this->shouldAbortFallback($e)) {
                throw $e;
            }

            $lastError = $e;
            foreach ($fallbacks as $candidate) {
                try {
                    return $this->postJson($url, $candidate, false);
                } catch (\Throwable $fallbackError) {
                    if ($this->shouldAbortFallback($fallbackError)) {
                        throw $fallbackError;
                    }

                    $lastError = $fallbackError;
                    // keep trying
                }
            }

            Log::error('fedapay:error', [
                'stage' => 'post-fallback-exhausted',
                'url' => $url,
                'body' => $lastError->getMessage(),
            ]);

            throw $lastError;
        }
    }

    private function shouldAbortFallback(\Throwable $error): bool
    {
        $status = (int) $error->getCode();
        if (in_array($status, [401, 403], true)) {
            return true;
        }

        $message = strtolower($error->getMessage());
        return str_contains($message, 'http 401') || str_contains($message, 'http 403');
    }

    private function findFirstUrl(mixed $data): ?string
    {
        if (is_string($data)) {
            $v = trim($data);
            if (str_starts_with($v, 'http://') || str_starts_with($v, 'https://')) {
                return $v;
            }
            return null;
        }

        if (is_array($data)) {
            foreach (['payment_url', 'url', 'redirect_url', 'checkout_url'] as $key) {
                $value = $data[$key] ?? null;
                if (is_string($value) && (str_starts_with($value, 'http://') || str_starts_with($value, 'https://'))) {
                    return $value;
                }
            }

            foreach ($data as $value) {
                $found = $this->findFirstUrl($value);
                if ($found) {
                    return $found;
                }
            }
        }

        return null;
    }

    private function sanitizeCurrency(mixed $currency): string
    {
        $value = strtoupper(trim((string) ($currency ?? '')));
        if ($value !== '' && preg_match('/^[A-Z]{3}$/', $value)) {
            return $value;
        }

        $fallback = strtoupper(trim((string) ($this->defaultCurrency ?? 'XOF')));
        return ($fallback !== '' && preg_match('/^[A-Z]{3}$/', $fallback)) ? $fallback : 'XOF';
    }

    private function resolveCurrencyId(string $currency, array $account): ?int
    {
        $code = strtoupper(trim($currency));
        $configured = $this->currencyIds[$code] ?? null;
        if (is_numeric($configured)) {
            return (int) $configured;
        }

        foreach ((array) ($account['currencies'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }

            if (strtoupper((string) ($row['iso'] ?? '')) === $code && is_numeric($row['id'] ?? null)) {
                return (int) $row['id'];
            }
        }

        return null;
    }

    private function resolveBalance(string $mode, array $account): array
    {
        foreach ($this->balanceModeCandidates($mode) as $candidate) {
            $configured = $this->payoutBalanceIds[$candidate] ?? null;
            if (is_numeric($configured)) {
                return [
                    'id' => (int) $configured,
                    'mode' => $candidate,
                ];
            }
        }

        foreach ((array) ($account['balances'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }

            $rowMode = strtolower((string) ($row['mode'] ?? ''));
            if (!in_array($rowMode, $this->balanceModeCandidates($mode), true)) {
                continue;
            }

            if (is_numeric($row['id'] ?? null)) {
                return [
                    'id' => (int) $row['id'],
                    'mode' => $rowMode,
                ];
            }
        }

        return [];
    }

    private function balanceModeCandidates(string $mode): array
    {
        $normalized = strtolower(trim($mode));

        return match ($normalized) {
            'moov_ci', 'moov_tg', 'moov_bf', 'moov', 'moov_bj' => ['moov_ci', 'moov_tg', 'moov_bf', 'moov', 'moov_bj'],
            'orange_ci', 'orange_bf', 'orange_ml', 'orange_sn', 'orange_money' => ['orange_ci', 'orange_bf', 'orange_ml', 'orange_sn', 'orange_money'],
            'wave_ci', 'wave_sn', 'wave' => ['wave_ci', 'wave_sn', 'wave'],
            'mtn_ci', 'mtn', 'mtn_bj' => ['mtn_ci', 'mtn', 'mtn_bj'],
            'togocel', 'togocel_tmoney', 'mobile_money' => ['togocel', 'togocel_tmoney', 'mobile_money'],
            'bestcash', 'bestcash_money' => ['bestcash', 'bestcash_money'],
            'celtiis', 'celtiis_cash' => ['celtiis', 'celtiis_cash'],
            'coris', 'coris_money' => ['coris', 'coris_money'],
            'free', 'free_sn', 'free_senegal' => ['free', 'free_sn', 'free_senegal'],
            'airtel', 'airtel_ne', 'airtel_niger' => ['airtel', 'airtel_ne', 'airtel_niger'],
            'bank_transfer', 'bank' => ['bank_transfer', 'bank'],
            default => [$normalized],
        };
    }

    private function retrieveAccountProfile(): array
    {
        foreach (['/account', '/accounts/current', '/accounts/me'] as $path) {
            $payload = $this->tryGetJson($this->endpoint($path));
            if (!$payload) {
                continue;
            }

            $account = $this->extractAccountPayload($payload);
            if ($account !== []) {
                return $account;
            }
        }

        return [];
    }

    private function extractAccountPayload(array $payload): array
    {
        $candidate = null;

        if (isset($payload['balances']) || isset($payload['currencies'])) {
            $candidate = $payload;
        } elseif (is_array($payload['account'] ?? null)) {
            $candidate = $payload['account'];
        } elseif (is_array(Arr::get($payload, 'data.account'))) {
            $candidate = Arr::get($payload, 'data.account');
        } elseif (is_array($payload['data'] ?? null) && (isset($payload['data']['balances']) || isset($payload['data']['currencies']))) {
            $candidate = $payload['data'];
        } elseif (is_array(Arr::get($payload, 'v1.account'))) {
            $candidate = Arr::get($payload, 'v1.account');
        } elseif (is_array(Arr::get($payload, 'data.v1.account'))) {
            $candidate = Arr::get($payload, 'data.v1.account');
        }

        if (!is_array($candidate)) {
            return [];
        }

        if (!isset($candidate['currencies']) || !is_array($candidate['currencies'])) {
            $candidate['currencies'] = $this->collectRowsByKeys($payload, ['currencies', 'currency']);
        }

        if (!isset($candidate['balances']) || !is_array($candidate['balances'])) {
            $candidate['balances'] = $this->collectRowsByKeys($payload, ['balances', 'balance']);
        }

        return $candidate;
    }

    private function collectRowsByKeys(array $payload, array $keys): array
    {
        $rows = [];

        $walker = function (mixed $value) use (&$rows, $keys, &$walker): void {
            if (!is_array($value)) {
                return;
            }

            foreach ($value as $key => $child) {
                if (is_string($key) && in_array(strtolower($key), $keys, true) && is_array($child)) {
                    if (array_is_list($child)) {
                        foreach ($child as $row) {
                            if (is_array($row)) {
                                $rows[] = $row;
                            }
                        }
                    } else {
                        $rows[] = $child;
                    }
                }

                $walker($child);
            }
        };

        $walker($payload);

        return array_values(array_filter($rows, static fn ($row) => is_array($row)));
    }

    private function tryGetJson(string $url): ?array
    {
        try {
            $response = $this->http()->get($url);
            if (!$response->successful()) {
                return null;
            }

            return (array) ($response->json() ?? []);
        } catch (\Throwable) {
            return null;
        }
    }
}

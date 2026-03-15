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
    private string $secretKey;
    private string $environment;
    private string $baseUrl;
    private int $timeout;
    private string $defaultCurrency;
    private ?string $defaultCallbackUrl;
    private ?string $webhookSecret;
    private int $webhookTolerance;

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
        $mode = strtolower(trim((string) ($payload['mode'] ?? 'mobile_money')));
        if (!in_array($mode, ['mobile_money', 'bank_transfer'], true)) {
            $mode = 'mobile_money';
        }

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
                    'country' => strtolower((string) ($payload['customer_country'] ?? 'BJ')),
                ];
            }
        }

        $basePayload = array_filter([
            'amount' => $amountInt,
            'currency' => ['iso' => $currency],
            'customer' => $customer,
            'mode' => $mode,
            'metadata' => is_array($payload['metadata'] ?? null) ? $payload['metadata'] : null,
            'custom_metadata' => is_array($payload['custom_metadata'] ?? null) ? $payload['custom_metadata'] : null,
            'merchant_reference' => (string) ($payload['merchant_reference'] ?? ''),
        ], static fn ($value) => $value !== null && $value !== '');

        return $this->postWithFallback($this->endpoint('/payouts'), $basePayload, [
            ['payout' => $basePayload],
            array_merge($basePayload, ['currency' => $currency]),
            ['payout' => array_merge($basePayload, ['currency' => $currency])],
        ]);
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

    private function requestJson(string $method, string $url, array $payload = []): array
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
            Log::error('fedapay:error', [
                'stage' => $method,
                'url' => $url,
                'status' => $response->status(),
                'body' => $snippet,
            ]);
            throw new \RuntimeException('FedaPay API request failed (HTTP ' . $response->status() . '): ' . $snippet);
        }

        if ($response->status() === 204) {
            return [];
        }

        return (array) ($response->json() ?? []);
    }

    private function postJson(string $url, array $payload): array
    {
        return $this->requestJson('post', $url, $payload);
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
            foreach ($fallbacks as $candidate) {
                try {
                    return $this->postJson($url, $candidate);
                } catch (\Throwable) {
                    // keep trying
                }
            }
            throw $e;
        }
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
}

<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PayPalService
{
    private string $clientId;
    private string $clientSecret;
    private string $environment;
    private string $baseUrl;
    private int $timeout;
    private string $defaultCurrency;
    private float $xofToEurRate;
    private string $webhookId;
    private ?string $returnUrl;
    private ?string $cancelUrl;

    public function __construct()
    {
        $config = config('paypal');

        $this->clientId = (string) ($config['client_id'] ?? env('PAYPAL_CLIENT_ID', ''));
        $this->clientSecret = (string) ($config['client_secret'] ?? env('PAYPAL_CLIENT_SECRET', ''));
        $this->environment = strtolower((string) ($config['environment'] ?? env('PAYPAL_ENV', 'sandbox')));
        $this->timeout = (int) ($config['timeout'] ?? env('PAYPAL_TIMEOUT', 15));
        $this->defaultCurrency = strtoupper((string) ($config['default_currency'] ?? env('PAYPAL_DEFAULT_CURRENCY', 'EUR')));
        $this->xofToEurRate = (float) ($config['xof_to_eur_rate'] ?? env('PAYPAL_XOF_TO_EUR_RATE', 655.957));
        $this->webhookId = trim((string) ($config['webhook_id'] ?? env('PAYPAL_WEBHOOK_ID', '')));
        $this->returnUrl = $config['return_url'] ?? env('PAYPAL_RETURN_URL');
        $this->cancelUrl = $config['cancel_url'] ?? env('PAYPAL_CANCEL_URL');

        $override = (string) ($config['base_url'] ?? env('PAYPAL_BASE_URL', ''));
        if ($override !== '') {
            $this->baseUrl = rtrim($override, '/');
        } else {
            $this->baseUrl = $this->environment === 'live'
                ? 'https://api-m.paypal.com'
                : 'https://api-m.sandbox.paypal.com';
        }
    }

    public function isConfigured(): bool
    {
        return $this->clientId !== '' && $this->clientSecret !== '';
    }

    public function isWebhookConfigured(): bool
    {
        return $this->isConfigured() && $this->webhookId !== '';
    }

    public function createCheckoutOrder(Order $order, User $user, array $meta = []): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('PayPal not configured (missing: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET)');
        }

        $sourceAmount = round((float) ($meta['amount'] ?? $order->total_price ?? 0), 2);
        if ($sourceAmount <= 0) {
            throw new \RuntimeException('PayPal order amount must be greater than zero');
        }

        $sourceCurrency = strtoupper((string) ($meta['source_currency'] ?? 'XOF'));
        $currency = strtoupper((string) ($meta['currency'] ?? $this->defaultCurrency));
        $convertedAmount = $this->convertAmount($sourceAmount, $sourceCurrency, $currency);

        $returnUrl = (string) ($meta['return_url'] ?? $this->returnUrl ?? '');
        $cancelUrl = (string) ($meta['cancel_url'] ?? $this->cancelUrl ?? '');
        $description = (string) ($meta['description'] ?? sprintf('PRIME Gaming Order #%s', $order->reference ?? $order->id));

        $payload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => 'order-' . $order->id,
                'custom_id' => (string) $order->id,
                'description' => $description,
                'amount' => [
                    'currency_code' => $currency,
                    'value' => number_format($convertedAmount, 2, '.', ''),
                ],
            ]],
            'application_context' => array_filter([
                'brand_name' => 'PRIME Gaming',
                'landing_page' => 'LOGIN',
                'user_action' => 'PAY_NOW',
                'shipping_preference' => $order->hasPhysicalItems() ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING',
                'return_url' => $returnUrl !== '' ? $returnUrl : null,
                'cancel_url' => $cancelUrl !== '' ? $cancelUrl : null,
            ]),
        ];

        $response = $this->api()
            ->withToken($this->getAccessToken())
            ->post($this->endpoint('/v2/checkout/orders'), $payload);

        $data = $this->decodeResponse($response->status(), $response->body());

        $orderId = (string) (Arr::get($data, 'id') ?? '');
        $approveUrl = $this->extractLink($data, 'approve');

        if ($orderId === '' || $approveUrl === '') {
            throw new \RuntimeException('PayPal did not return an approval link');
        }

        return [
            'order_id' => $orderId,
            'approve_url' => $approveUrl,
            'provider_currency' => $currency,
            'provider_amount' => $convertedAmount,
            'source_currency' => $sourceCurrency,
            'source_amount' => $sourceAmount,
            'raw' => $data,
        ];
    }

    public function captureOrder(string $orderId, ?string $requestId = null): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('PayPal not configured (missing: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET)');
        }

        $request = $this->api()->withToken($this->getAccessToken());
        if ($requestId) {
            $request = $request->withHeaders(['PayPal-Request-Id' => $requestId]);
        }

        $response = $request->post($this->endpoint('/v2/checkout/orders/' . urlencode($orderId) . '/capture'), new \stdClass());
        return $this->decodeResponse($response->status(), $response->body());
    }

    public function showOrder(string $orderId): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('PayPal not configured (missing: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET)');
        }

        $response = $this->api()
            ->withToken($this->getAccessToken())
            ->get($this->endpoint('/v2/checkout/orders/' . urlencode($orderId)));

        return $this->decodeResponse($response->status(), $response->body());
    }

    public function normalizeOrderStatus(array $payload): string
    {
        $status = strtoupper((string) (Arr::get($payload, 'status') ?? ''));

        return match ($status) {
            'COMPLETED' => 'completed',
            'VOIDED' => 'failed',
            'APPROVED' => 'approved',
            'CREATED', 'PAYER_ACTION_REQUIRED', 'SAVED' => 'pending',
            default => 'pending',
        };
    }

    public function extractCaptureId(array $payload): ?string
    {
        $captureId = Arr::get($payload, 'purchase_units.0.payments.captures.0.id');
        if (is_string($captureId) && trim($captureId) !== '') {
            return trim($captureId);
        }

        return null;
    }

    public function verifyWebhookSignature(array $headers, array $event): bool
    {
        if (!$this->isWebhookConfigured()) {
            throw new \RuntimeException('PayPal webhook not configured (missing: PAYPAL_WEBHOOK_ID)');
        }

        $payload = [
            'transmission_id' => trim((string) ($headers['paypal-transmission-id'] ?? '')),
            'transmission_time' => trim((string) ($headers['paypal-transmission-time'] ?? '')),
            'cert_url' => trim((string) ($headers['paypal-cert-url'] ?? '')),
            'auth_algo' => trim((string) ($headers['paypal-auth-algo'] ?? '')),
            'transmission_sig' => trim((string) ($headers['paypal-transmission-sig'] ?? '')),
            'webhook_id' => $this->webhookId,
            'webhook_event' => $event,
        ];

        $response = $this->api()
            ->withToken($this->getAccessToken())
            ->post($this->endpoint('/v1/notifications/verify-webhook-signature'), $payload);

        $data = $this->decodeResponse($response->status(), $response->body());

        return strtoupper((string) (Arr::get($data, 'verification_status') ?? '')) === 'SUCCESS';
    }

    public function extractWebhookOrderId(array $payload): ?string
    {
        $eventType = strtoupper(trim((string) ($payload['event_type'] ?? '')));

        if (str_starts_with($eventType, 'CHECKOUT.ORDER.')) {
            $orderId = trim((string) Arr::get($payload, 'resource.id', ''));
            return $orderId !== '' ? $orderId : null;
        }

        $orderId = trim((string) Arr::get($payload, 'resource.supplementary_data.related_ids.order_id', ''));
        if ($orderId !== '') {
            return $orderId;
        }

        $fallback = trim((string) Arr::get($payload, 'resource.id', ''));
        return $fallback !== '' ? $fallback : null;
    }

    public function convertAmount(float $amount, string $sourceCurrency, string $targetCurrency): float
    {
        $source = strtoupper(trim($sourceCurrency));
        $target = strtoupper(trim($targetCurrency));

        if ($source === $target) {
            return round($amount, 2);
        }

        if ($source === 'FCFA') {
            $source = 'XOF';
        }

        if ($source === 'XOF' && $target === 'EUR') {
            $rate = $this->xofToEurRate > 0 ? $this->xofToEurRate : 655.957;
            return round($amount / $rate, 2);
        }

        throw new \RuntimeException(sprintf('Unsupported PayPal currency conversion: %s -> %s', $source, $target));
    }

    private function getAccessToken(): string
    {
        $cacheKey = 'paypal_access_token_' . md5($this->baseUrl . '|' . $this->clientId);

        $cached = Cache::get($cacheKey);
        if (is_string($cached) && trim($cached) !== '') {
            return $cached;
        }

        $response = $this->api()
            ->asForm()
            ->withBasicAuth($this->clientId, $this->clientSecret)
            ->post($this->endpoint('/v1/oauth2/token'), [
                'grant_type' => 'client_credentials',
            ]);

        $data = $this->decodeResponse($response->status(), $response->body());
        $token = (string) (Arr::get($data, 'access_token') ?? '');
        $expiresIn = max(60, (int) (Arr::get($data, 'expires_in') ?? 300));

        if ($token === '') {
            throw new \RuntimeException('PayPal did not return an access token');
        }

        Cache::put($cacheKey, $token, now()->addSeconds(max(60, $expiresIn - 120)));

        return $token;
    }

    private function api(): PendingRequest
    {
        return Http::timeout($this->timeout)
            ->acceptJson()
            ->asJson();
    }

    private function endpoint(string $path): string
    {
        return rtrim($this->baseUrl, '/') . '/' . ltrim($path, '/');
    }

    private function decodeResponse(int $status, string $body): array
    {
        $data = json_decode($body, true);
        if (!is_array($data)) {
            $data = [];
        }

        if ($status >= 400) {
            $message = (string) (Arr::get($data, 'message') ?? Arr::get($data, 'error_description') ?? 'PayPal API request failed');
            throw new \RuntimeException('PayPal API request failed (HTTP ' . $status . '): ' . $message);
        }

        return $data;
    }

    private function extractLink(array $payload, string $rel): string
    {
        $links = Arr::get($payload, 'links', []);
        if (!is_array($links)) {
            return '';
        }

        foreach ($links as $link) {
            if (!is_array($link)) {
                continue;
            }
            if (strcasecmp((string) ($link['rel'] ?? ''), $rel) === 0) {
                return (string) ($link['href'] ?? '');
            }
        }

        return '';
    }
}
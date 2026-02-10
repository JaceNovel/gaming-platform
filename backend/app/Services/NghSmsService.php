<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NghSmsService
{
    private string $baseUrl;
    private string $apiKey;
    private string $apiSecret;
    private string $defaultFrom;
    private int $timeout;

    public function __construct()
    {
        $cfg = config('ngh_sms');
        $this->baseUrl = rtrim((string) ($cfg['base_url'] ?? ''), '/');
        $this->apiKey = (string) ($cfg['api_key'] ?? '');
        $this->apiSecret = (string) ($cfg['api_secret'] ?? '');
        $this->defaultFrom = (string) ($cfg['from'] ?? '');
        $this->timeout = (int) ($cfg['timeout'] ?? 15);
    }

    public function isConfigured(): bool
    {
        return $this->baseUrl !== '' && $this->apiKey !== '' && $this->apiSecret !== '';
    }

    /**
     * Send a single SMS.
     *
     * @param string $to Destination number including country code (digits only recommended), e.g. 22892470847
     * @param string $text Message content
     * @param string|int $reference Unique reference (client side)
     * @param string|null $from Sender ID
     * @return array Parsed JSON response
     */
    public function sendSingle(string $to, string $text, string|int $reference, ?string $from = null): array
    {
        $this->assertConfigured();

        $toNormalized = $this->normalizePhone($to);
        $fromValue = trim((string) ($from ?? $this->defaultFrom));
        if ($fromValue === '') {
            $fromValue = 'PRIME';
        }

        $payload = [
            'from' => $fromValue,
            'to' => is_numeric($toNormalized) ? (int) $toNormalized : $toNormalized,
            'text' => $text,
            'reference' => (string) $reference,
            'api_key' => $this->apiKey,
            'api_secret' => $this->apiSecret,
        ];

        return $this->postJson('/send-sms', $payload, 'sendSingle');
    }

    /**
     * Fetch current account balance.
     */
    public function balance(): array
    {
        $this->assertConfigured();

        $payload = [
            'api_key' => $this->apiKey,
            'api_secret' => $this->apiSecret,
        ];

        return $this->postJson('/balance', $payload, 'balance');
    }

    private function client(): PendingRequest
    {
        return Http::timeout($this->timeout)
            ->acceptJson()
            ->asJson();
    }

    private function postJson(string $path, array $payload, string $op): array
    {
        $url = $this->baseUrl . $path;

        $res = $this->client()->post($url, $payload);
        $json = $res->json();

        if (!$res->ok()) {
            Log::warning('ngh_sms:http_error', [
                'op' => $op,
                'status' => $res->status(),
                'body' => $this->safeSnippet($res->body()),
            ]);
            throw new \RuntimeException('NGH SMS request failed (HTTP ' . $res->status() . ')');
        }

        if (!is_array($json)) {
            Log::warning('ngh_sms:invalid_json', [
                'op' => $op,
                'status' => $res->status(),
                'body' => $this->safeSnippet($res->body()),
            ]);
            throw new \RuntimeException('NGH SMS invalid response');
        }

        return $json;
    }

    private function assertConfigured(): void
    {
        if ($this->baseUrl === '') {
            throw new \RuntimeException('NGH SMS not configured (missing: NGH_SMS_BASE_URL)');
        }
        if ($this->apiKey === '' || $this->apiSecret === '') {
            throw new \RuntimeException('NGH SMS not configured (missing: NGH_SMS_API_KEY/NGH_SMS_API_SECRET)');
        }
    }

    private function normalizePhone(string $to): string
    {
        $v = trim($to);
        if ($v === '') return '';
        // Keep digits only (also strips +, spaces, dashes).
        return preg_replace('/\D+/', '', $v) ?? $v;
    }

    private function safeSnippet(?string $body): string
    {
        $raw = (string) ($body ?? '');
        $raw = trim($raw);
        if ($raw === '') return '';
        // Avoid huge logs.
        if (strlen($raw) > 900) {
            return substr($raw, 0, 900) . '…';
        }
        return $raw;
    }
}

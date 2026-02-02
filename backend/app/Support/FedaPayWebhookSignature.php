<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

class FedaPayWebhookSignature
{
    /**
     * Verify FedaPay webhook signature.
     *
     * Header format: "t=TIMESTAMP,v1=HEX" (multiple v1 allowed)
     * Signature: hash_hmac('sha256', "{$t}.{$raw}", FEDAPAY_WEBHOOK_SECRET)
     *
     * IMPORTANT: Only return false if signature is truly invalid.
     */
    public static function verifyFedapayWebhookSignature(string $rawBody, string $signatureHeader, string $webhookSecret, int $tolerance): bool
    {
        $secret = trim($webhookSecret);
        $header = trim($signatureHeader);

        if ($secret === '' || strlen($secret) < 16) {
            Log::error('fedapay:webhook-secret-invalid', [
                'len' => strlen($secret),
                'configured' => $secret !== '',
            ]);
            return false;
        }

        if ($header === '') {
            Log::warning('fedapay:signature-missing', [
                'raw_len' => strlen($rawBody),
                'raw_sha256' => hash('sha256', $rawBody),
            ]);
            return false;
        }

        $parsed = self::parseSignatureHeader($header);
        $timestampRaw = (string) ($parsed['timestamp'] ?? '');
        $v1List = (array) ($parsed['v1'] ?? []);

        if ($timestampRaw === '' || count($v1List) === 0) {
            Log::warning('fedapay:signature-invalid-format', [
                'header_prefix' => substr($header, 0, 40),
                'timestamp_present' => $timestampRaw !== '',
                'v1_count' => count($v1List),
            ]);
            return false;
        }

        if (!ctype_digit($timestampRaw)) {
            Log::warning('fedapay:signature-invalid-timestamp', [
                'timestamp' => $timestampRaw,
                'header_prefix' => substr($header, 0, 40),
            ]);
            return false;
        }

        $timestamp = (int) $timestampRaw;
        $tolerance = max(0, (int) $tolerance);
        if ($tolerance > 0) {
            $delta = abs(now()->getTimestamp() - $timestamp);
            if ($delta > $tolerance) {
                Log::warning('fedapay:signature-timestamp-out-of-tolerance', [
                    'timestamp' => $timestamp,
                    'delta_seconds' => $delta,
                    'tolerance_seconds' => $tolerance,
                    'raw_sha256' => hash('sha256', $rawBody),
                ]);
                return false;
            }
        }

        $expected = hash_hmac('sha256', $timestampRaw . '.' . $rawBody, $secret);
        $expectedLower = strtolower($expected);

        foreach ($v1List as $sig) {
            $sig = strtolower(self::cleanValue((string) $sig));
            if ($sig !== '' && hash_equals($expectedLower, $sig)) {
                return true;
            }
        }

        Log::warning('fedapay:invalid-signature', [
            'raw_len' => strlen($rawBody),
            'raw_sha256' => hash('sha256', $rawBody),
            'header_prefix' => substr($header, 0, 40),
            'timestamp' => $timestampRaw,
            'v1_count' => count($v1List),
            'expected_prefix' => substr($expectedLower, 0, 8),
            'first_sig_prefix' => isset($v1List[0]) ? substr(strtolower(self::cleanValue((string) $v1List[0])), 0, 8) : null,
        ]);

        return false;
    }

    /**
     * Verify FedaPay webhook signature.
     *
     * Expected header format: "t=TIMESTAMP,v1=HEX" (multiple v1 allowed)
     * Signature is: hash_hmac('sha256', TIMESTAMP . '.' . RAW_BODY, FEDAPAY_WEBHOOK_SECRET)
     */
    public static function verify(string $signatureHeader, string $rawBody, string $webhookSecret): bool
    {
        $tolerance = (int) env('FEDAPAY_WEBHOOK_TOLERANCE', 300);
        return self::verifyFedapayWebhookSignature($rawBody, $signatureHeader, $webhookSecret, $tolerance);
    }

    /**
     * @return array{timestamp:?string,v1:array<string>}
     */
    public static function parseSignatureHeader(string $header): array
    {
        $timestamp = null;
        $v1 = [];

        // Split on commas (e.g. t=...,v1=...,v1=...)
        $parts = array_map('trim', explode(',', $header));
        foreach ($parts as $part) {
            if ($part === '' || !str_contains($part, '=')) {
                continue;
            }

            [$k, $v] = array_map('trim', explode('=', $part, 2));
            $k = strtolower($k);
            $v = self::cleanValue($v);

            if ($k === 't' && $v !== '') {
                $timestamp = $v;
                continue;
            }

            if ($k === 'v1' && $v !== '') {
                $v1[] = $v;
                continue;
            }
        }

        return ['timestamp' => $timestamp, 'v1' => $v1];
    }

    private static function cleanValue(string $value): string
    {
        $sig = trim($value);
        return trim($sig, " \t\n\r\0\x0B\"'");
    }
}

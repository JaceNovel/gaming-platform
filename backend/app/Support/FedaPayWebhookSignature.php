<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

class FedaPayWebhookSignature
{
    private static function base64UrlEncode(string $binary): string
    {
        return rtrim(strtr(base64_encode($binary), '+/', '-_'), '=');
    }

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

        $parsed = self::parseFedaPaySignatureHeader($header);
        $timestampRaw = $parsed['timestamp'];
        $v1List = $parsed['v1'];

        // IMPORTANT: if it looks like composite format but no v1 found => reject.
        if ($parsed['format'] === 't_v1') {
            if (empty($timestampRaw) || count($v1List) === 0) {
                Log::warning('fedapay:invalid-signature', [
                    'raw_len' => strlen($rawBody),
                    'raw_sha256' => hash('sha256', $rawBody),
                    'header_prefix' => substr($header, 0, 20),
                    'timestamp_present' => !empty($timestampRaw),
                    'v1_count' => count($v1List),
                    'exp_ts_hex_prefix' => null,
                    'exp_raw_hex_prefix' => substr(hash_hmac('sha256', $rawBody, $secret), 0, 8),
                    'first_sig_prefix' => substr((string) ($v1List[0] ?? ''), 0, 8),
                ]);
                return false;
            }
        }

        if ($timestampRaw !== null && $timestampRaw !== '' && !ctype_digit($timestampRaw)) {
            Log::warning('fedapay:signature-invalid-timestamp', [
                'timestamp' => $timestampRaw,
                'header_prefix' => substr($header, 0, 40),
            ]);
            return false;
        }

        $timestamp = $timestampRaw !== null && $timestampRaw !== '' ? (int) $timestampRaw : null;
        // Some providers send webhook timestamps in milliseconds.
        // The HMAC must always use the original timestamp string, but the tolerance check should
        // compare in seconds.
        $timestampSeconds = $timestamp;
        if ($timestamp !== null && $timestampRaw !== null) {
            if (strlen($timestampRaw) >= 13 || $timestamp > 20000000000) {
                $timestampSeconds = (int) floor($timestamp / 1000);
            }
        }
        $tolerance = max(0, (int) $tolerance);
        if ($tolerance > 0 && $timestampSeconds !== null) {
            $delta = abs(now()->getTimestamp() - $timestampSeconds);
            if ($delta > $tolerance) {
                Log::warning('fedapay:signature-timestamp-out-of-tolerance', [
                    'timestamp_raw' => $timestampRaw,
                    'timestamp_seconds' => $timestampSeconds,
                    'delta_seconds' => $delta,
                    'tolerance_seconds' => $tolerance,
                    'raw_sha256' => hash('sha256', $rawBody),
                ]);
                return false;
            }
        }

        // Compatibility candidates:
        // A) HMAC(rawBody) as hex and base64
        $expRawHex = hash_hmac('sha256', $rawBody, $secret);
        $expRawBin = hash_hmac('sha256', $rawBody, $secret, true);
        $expRawB64 = base64_encode($expRawBin);
        $expRawB64NoPad = rtrim($expRawB64, '=');
        $expRawB64Url = self::base64UrlEncode($expRawBin);

        // B) HMAC("{timestamp}.{raw}") as hex and base64
        $expTsHex = null;
        $expTsB64 = null;
        $expTsB64NoPad = null;
        $expTsB64Url = null;
        if ($timestampRaw !== null && $timestampRaw !== '') {
            $signedPayload = $timestampRaw . '.' . $rawBody;
            $expTsHex = hash_hmac('sha256', $signedPayload, $secret);
            $expTsBin = hash_hmac('sha256', $signedPayload, $secret, true);
            $expTsB64 = base64_encode($expTsBin);
            $expTsB64NoPad = rtrim($expTsB64, '=');
            $expTsB64Url = self::base64UrlEncode($expTsBin);
        }

        $isValid = false;
        foreach ($v1List as $sig) {
            $sig = trim((string) $sig);
            if ($sig === '') {
                continue;
            }

            // Remove any accidental "v1=" prefix.
            if (str_starts_with(strtolower($sig), 'v1=')) {
                $sig = substr($sig, 3);
                $sig = trim($sig);
            }

            $sigClean = self::cleanValue($sig);

            // Hex signatures are case-insensitive.
            $sigHex = ctype_xdigit($sigClean) ? strtolower($sigClean) : null;
            $expRawHexLower = strtolower($expRawHex);
            $expTsHexLower = $expTsHex !== null ? strtolower($expTsHex) : null;

            $isValid = $isValid
                || ($expTsHexLower !== null && $sigHex !== null && hash_equals($expTsHexLower, $sigHex))
                || ($expTsB64 !== null && hash_equals($expTsB64, $sigClean))
                || ($expTsB64NoPad !== null && hash_equals($expTsB64NoPad, $sigClean))
                || ($expTsB64Url !== null && hash_equals($expTsB64Url, $sigClean))
                || ($sigHex !== null && hash_equals($expRawHexLower, $sigHex))
                || hash_equals($expRawB64, $sigClean)
                || hash_equals($expRawB64NoPad, $sigClean)
                || hash_equals($expRawB64Url, $sigClean);

            if ($isValid) {
                return true;
            }
        }

        Log::warning('fedapay:invalid-signature', [
            'raw_len' => strlen($rawBody),
            'raw_sha256' => hash('sha256', $rawBody),
            'header_prefix' => substr($header, 0, 20),
            'format' => (string) ($parsed['format'] ?? ''),
            'secret_len' => strlen($secret),
            'timestamp_present' => !empty($timestampRaw),
            'v1_count' => count($v1List),
            'exp_ts_hex_prefix' => $expTsHex !== null ? substr(strtolower($expTsHex), 0, 8) : null,
            'exp_raw_hex_prefix' => substr(strtolower($expRawHex), 0, 8),
            'first_sig_prefix' => substr((string) ($v1List[0] ?? ''), 0, 8),
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
     * @return array{timestamp:?string,v1:array<string>,format:string}
     */
    public static function parseFedaPaySignatureHeader(string $h): array
    {
        $header = trim($h);
        $timestamp = null;
        $v1 = [];

        // Support:
        // - "t=...,v1=..." (Stripe-like)
        // - "t=..., v1=..., v1=..."
        // - "t=...,s=..." (some FedaPay variants)
        // Fallback raw: if not parseable, treat header as a single signature candidate.
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

            if (($k === 'v1' || $k === 's') && $v !== '') {
                $v1[] = $v;
                continue;
            }
        }

        $hasCompositeIndicators = str_contains($header, 't=') || str_contains($header, 'v1=') || str_contains($header, 's=');

        if ($timestamp !== null || count($v1) > 0 || $hasCompositeIndicators) {
            return [
                'timestamp' => $timestamp,
                'v1' => $v1,
                'format' => 't_v1',
            ];
        }

        $rawSig = self::cleanValue($header);
        return [
            'timestamp' => null,
            'v1' => $rawSig !== '' ? [$rawSig] : [],
            'format' => 'raw',
        ];
    }

    /**
     * Back-compat alias.
     *
     * @return array{timestamp:?string,v1:array<string>}
     */
    public static function parseSignatureHeader(string $header): array
    {
        $parsed = self::parseFedaPaySignatureHeader($header);
        return ['timestamp' => $parsed['timestamp'], 'v1' => $parsed['v1']];
    }

    private static function cleanValue(string $value): string
    {
        $sig = trim($value);
        return trim($sig, " \t\n\r\0\x0B\"'");
    }
}

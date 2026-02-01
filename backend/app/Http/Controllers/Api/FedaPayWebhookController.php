<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessFedaPayWebhook;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class FedaPayWebhookController extends Controller
{
    public function handle(Request $request)
    {
        // 1) Read raw body EXACT (never re-encode JSON)
        $raw = (string) $request->getContent();

        // 2) Header
        $h = (string) $request->header('x-fedapay-signature', '');

        // 7) Secret sanity check (do not leak its value)
        $secret = trim((string) env('FEDAPAY_WEBHOOK_SECRET', ''));
        if ($secret === '' || strlen($secret) < 16) {
            Log::error('fedapay:webhook-secret-invalid', [
                'len' => strlen($secret),
                'configured' => $secret !== '',
            ]);
        }

        // 3) Parse signature header (Stripe-like: t=...,v1=... or t=...,s=...)
        $parsed = $this->parseFedaPaySignatureHeader($h);
        $timestamp = (string) ($parsed['timestamp'] ?? '');
        $v1List = (array) ($parsed['v1'] ?? []);

        // 7) If header contains timestamp and signature-like key but no extracted signature => reject
        $hasSignatureLikeKey = preg_match('/(?:^|[\s,;])(v1|s|sig|signature)\s*=\s*/i', $h) === 1;
        if ($timestamp !== '' && $hasSignatureLikeKey && count($v1List) === 0) {
            Log::warning('fedapay:invalid-signature', [
                'raw_len' => strlen($raw),
                'raw_sha256' => hash('sha256', $raw),
                'header_prefix' => substr($h, 0, 20),
                'timestamp_present' => true,
                'v1_count' => 0,
                'exp_ts_hex_prefix' => null,
                'exp_raw_hex_prefix' => $secret !== '' ? substr(hash_hmac('sha256', $raw, $secret), 0, 8) : null,
                'first_sig_prefix' => null,
            ]);

            return response()->json(['error' => 'invalid signature'], Response::HTTP_UNAUTHORIZED);
        }

        // 4) Compute expected candidates
        $exp_raw_hex = $secret !== '' ? hash_hmac('sha256', $raw, $secret) : '';
        $exp_raw_b64 = $secret !== '' ? base64_encode(hash_hmac('sha256', $raw, $secret, true)) : '';

        $exp_ts_hex = '';
        $exp_ts_b64 = '';
        if ($secret !== '' && $timestamp !== '') {
            $signedPayload = $timestamp . '.' . $raw;
            $exp_ts_hex = hash_hmac('sha256', $signedPayload, $secret);
            $exp_ts_b64 = base64_encode(hash_hmac('sha256', $signedPayload, $secret, true));
        }

        // 5) Compare constant-time against each v1 signature
        $isValid = false;
        foreach ($v1List as $sig) {
            $sig = trim((string) $sig);
            if ($sig === '') {
                continue;
            }
            $sig = $this->cleanSignatureValue($sig);

            $isValid = $isValid
                || ($exp_ts_hex !== '' && hash_equals($exp_ts_hex, $sig))
                || ($exp_ts_b64 !== '' && hash_equals($exp_ts_b64, $sig))
                || ($exp_raw_hex !== '' && hash_equals($exp_raw_hex, $sig))
                || ($exp_raw_b64 !== '' && hash_equals($exp_raw_b64, $sig));

            if ($isValid) {
                break;
            }
        }

        if (!$isValid) {
            // 6) Debug SAFE
            Log::warning('fedapay:invalid-signature', [
                'raw_len' => strlen($raw),
                'raw_sha256' => hash('sha256', $raw),
                'header_prefix' => substr($h, 0, 20),
                'timestamp_present' => $timestamp !== '',
                'v1_count' => count($v1List),
                'exp_ts_hex_prefix' => $exp_ts_hex !== '' ? substr($exp_ts_hex, 0, 8) : null,
                'exp_raw_hex_prefix' => $exp_raw_hex !== '' ? substr($exp_raw_hex, 0, 8) : null,
                'first_sig_prefix' => isset($v1List[0]) ? substr($this->cleanSignatureValue((string) $v1List[0]), 0, 8) : null,
            ]);

            return response()->json(['error' => 'invalid signature'], Response::HTTP_UNAUTHORIZED);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            return response()->json(['success' => false, 'message' => 'Invalid JSON'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Attach a stable hash of the raw payload for idempotency.
        $payload['_meta'] = is_array($payload['_meta'] ?? null) ? $payload['_meta'] : [];
        $payload['_meta']['raw_hash'] = hash('sha256', $raw);
        $payload['_meta']['received_at'] = now()->toIso8601String();

        // Process synchronously to avoid missing credits when no queue worker is running.
        // Keep the response 2xx so the provider doesn't retry unnecessarily.
        try {
            ProcessFedaPayWebhook::dispatchSync($payload);
        } catch (\Throwable $e) {
            Log::error('fedapay:error', [
                'stage' => 'webhook-dispatch-sync',
                'message' => $e->getMessage(),
            ]);
        }

        return response()->json(['received' => true]);
    }

    /**
     * Parse FedaPay signature header.
     *
     * @return array{timestamp:?string,v1:array<string>,format:string}
     */
    private function parseFedaPaySignatureHeader(string $h): array
    {
        $header = trim($h);
        if ($header === '') {
            return ['timestamp' => null, 'v1' => [], 'format' => 'missing'];
        }

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
            $v = $this->cleanSignatureValue($v);

            if ($k === 't' && $v !== '') {
                $timestamp = $v;
                continue;
            }
            if (in_array($k, ['v1', 's', 'sig', 'signature'], true) && $v !== '') {
                $v1[] = $v;
                continue;
            }
        }

        if ($timestamp !== null || $v1 !== []) {
            return ['timestamp' => $timestamp, 'v1' => $v1, 'format' => $timestamp !== null ? 't_sig' : 'sig_only'];
        }

        // Fallback raw: treat entire header as the signature
        $sig = $this->cleanSignatureValue($header);
        return ['timestamp' => null, 'v1' => $sig !== '' ? [$sig] : [], 'format' => 'raw'];
    }

    private function cleanSignatureValue(string $value): string
    {
        $sig = trim($value);
        $sig = trim($sig, " \t\n\r\0\x0B\"'");

        // If someone passes key=value again, strip the prefix.
        if (str_starts_with(strtolower($sig), 'v1=')) {
            $sig = substr($sig, 3);
        } elseif (str_starts_with(strtolower($sig), 'sha256=')) {
            $sig = substr($sig, 7);
        }

        return trim($sig);
    }
}

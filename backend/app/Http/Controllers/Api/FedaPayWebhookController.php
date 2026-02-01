<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessFedaPayWebhook;
use App\Services\FedaPayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class FedaPayWebhookController extends Controller
{
    public function __construct(private FedaPayService $fedaPayService)
    {
    }

    public function handle(Request $request)
    {
        // 1) Read raw body EXACT (never re-encode JSON)
        $raw = (string) $request->getContent();

        // 2) Read signature header
        $sigHeader = (string) ($request->header('x-fedapay-signature') ?? '');

        // 7) Secret sanity check (do not leak its value)
        $secret = trim((string) env('FEDAPAY_WEBHOOK_SECRET', ''));
        if ($secret === '' || strlen($secret) < 16) {
            Log::error('fedapay:webhook-secret-invalid', [
                'len' => strlen($secret),
                'configured' => $secret !== '',
            ]);
        }

        // 3-5) Robust signature verification (hex + base64, multiple formats)
        [$sig, $format] = $this->extractSignature($sigHeader);
        $expectedHex = $secret !== '' ? hash_hmac('sha256', $raw, $secret) : '';
        $expectedB64 = $secret !== '' ? base64_encode(hash_hmac('sha256', $raw, $secret, true)) : '';

        $sigLower = strtolower($sig);
        $isValid = $expectedHex !== '' && (
            hash_equals($expectedHex, $sig)
            || hash_equals($expectedHex, $sigLower)
            || hash_equals($expectedB64, $sig)
            || hash_equals($expectedB64, $sigLower)
        );

        if (!$isValid) {
            // 6) Debug SAFE (no secret, no full signature, no raw body)
            Log::warning('fedapay:invalid-signature', [
                'raw_len' => strlen($raw),
                'raw_sha256' => hash('sha256', $raw),
                'sig_format' => $format,
                'sig_len' => strlen($sig),
                'expected_hex_prefix' => $expectedHex !== '' ? substr($expectedHex, 0, 8) : null,
                'sig_prefix' => $sig !== '' ? substr($sig, 0, 8) : null,
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
     * Extract signature from the `x-fedapay-signature` header.
     * Supports: sha256=<hex>, v1=<hex>, t=<ts>,v1=<hex>, raw hex/base64.
     *
     * @return array{0:string,1:string} [signature, format]
     */
    private function extractSignature(string $sigHeader): array
    {
        $header = trim($sigHeader);
        if ($header === '') {
            return ['', 'missing'];
        }

        // Common: key/value list separated by commas.
        // Example: t=1700000000,v1=abcdef...
        if (stripos($header, 'v1=') !== false) {
            if (preg_match('/(?:^|[\s,;])v1\s*=\s*([^,;\s]+)/i', $header, $m)) {
                $sig = trim((string) $m[1]);
                $sig = trim($sig, " \t\n\r\0\x0B\"'"
                );
                return [strtolower($sig), 'v1'];
            }
        }

        if (stripos($header, 'sha256=') !== false) {
            if (preg_match('/(?:^|[\s,;])sha256\s*=\s*([^,;\s]+)/i', $header, $m)) {
                $sig = trim((string) $m[1]);
                $sig = trim($sig, " \t\n\r\0\x0B\"'"
                );
                return [strtolower($sig), 'sha256'];
            }
        }

        $sig = trim($header, " \t\n\r\0\x0B\"'");
        return [strtolower($sig), 'raw'];
    }
}

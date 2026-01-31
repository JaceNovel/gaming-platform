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
        if (filter_var(env('FEDAPAY_WEBHOOK_DEBUG', false), FILTER_VALIDATE_BOOL) || config('app.debug')) {
            $allHeaders = $request->headers->all();
            $sanitizedHeaders = $allHeaders;
            foreach (['x-fedapay-signature', 'authorization'] as $sensitiveKey) {
                if (isset($sanitizedHeaders[$sensitiveKey])) {
                    $sanitizedHeaders[$sensitiveKey] = ['***'];
                }
            }

            Log::info('FEDAPAY_WEBHOOK_DEBUG', [
                'headers_keys' => array_keys($allHeaders),
                'content_type' => $request->header('content-type'),
                'raw_len' => strlen((string) $request->getContent()),
                'raw_sha256' => hash('sha256', (string) $request->getContent()),
                'all_headers' => $sanitizedHeaders,
            ]);
        }

        $raw = (string) $request->getContent();
        $signature = (string) ($request->header('x-fedapay-signature') ?? $request->header('X-FEDAPAY-SIGNATURE') ?? '');

        if (!$this->fedaPayService->verifyWebhookSignature($raw, $signature)) {
            Log::warning('fedapay:error', [
                'stage' => 'webhook-signature',
                'has_signature' => $signature !== '',
            ]);
            return response()->json(['success' => false, 'message' => 'Invalid signature'], Response::HTTP_UNAUTHORIZED);
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
}

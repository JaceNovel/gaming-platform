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
        $raw = (string) $request->getContent();
        $signature = $request->header('X-FEDAPAY-SIGNATURE');

        if (!$this->fedaPayService->verifyWebhookSignature($raw, $signature)) {
            Log::warning('fedapay:error', [
                'stage' => 'webhook-signature',
                'has_signature' => (bool) $signature,
            ]);
            return response()->json(['success' => false, 'message' => 'Invalid signature'], Response::HTTP_BAD_REQUEST);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            return response()->json(['success' => false, 'message' => 'Invalid JSON'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

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

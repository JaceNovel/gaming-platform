<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessPayout;
use App\Models\Payment;
use App\Models\Payout;
use App\Services\MonerooService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;

class MonerooWebhookController extends Controller
{
    public function __construct(
        private MonerooService $monerooService,
        private MonerooPaymentController $monerooPaymentController,
    ) {
    }

    public function handle(Request $request)
    {
        $raw = (string) $request->getContent();
        $signature = (string) $request->header('X-Moneroo-Signature', '');

        if (!$this->monerooService->verifyWebhookSignature($raw, $signature)) {
            return response()->json(['received' => false], 403);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            return response()->json(['received' => true, 'ignored' => true]);
        }

        $event = strtolower(trim((string) ($payload['event'] ?? '')));
        $entityId = trim((string) (Arr::get($payload, 'data.id') ?? ''));

        try {
            if (str_starts_with($event, 'payment.') && $entityId !== '') {
                $payment = Payment::query()
                    ->where('method', 'moneroo')
                    ->where('transaction_id', $entityId)
                    ->latest('id')
                    ->first();

                if ($payment) {
                    $this->monerooPaymentController->syncPayment($payment, 'webhook', $entityId);
                } else {
                    Log::info('moneroo:webhook-payment-missing', ['event' => $event, 'transaction_id' => $entityId]);
                }
            }

            if (str_starts_with($event, 'payout.') && $entityId !== '') {
                $payout = Payout::query()
                    ->where('provider', 'MONEROO')
                    ->where('provider_ref', $entityId)
                    ->latest('id')
                    ->first();

                if ($payout) {
                    ProcessPayout::dispatch((string) $payout->id)->afterResponse();
                } else {
                    Log::info('moneroo:webhook-payout-missing', ['event' => $event, 'transaction_id' => $entityId]);
                }
            }
        } catch (\Throwable $e) {
            Log::error('moneroo:webhook-error', [
                'event' => $event,
                'transaction_id' => $entityId !== '' ? $entityId : null,
                'message' => $e->getMessage(),
            ]);
        }

        return response()->json(['received' => true]);
    }
}
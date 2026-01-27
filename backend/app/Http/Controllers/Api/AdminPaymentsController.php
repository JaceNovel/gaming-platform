<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Services\AdminAuditLogger;
use App\Services\CinetPayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminPaymentsController extends Controller
{
    public function index(Request $request)
    {
        $query = Payment::with(['order.user'])
            ->latest('id');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($request->filled('transaction_id')) {
            $query->where('transaction_id', $request->query('transaction_id'));
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function resync(Request $request, Payment $payment, CinetPayService $cinetPayService, AdminAuditLogger $auditLogger)
    {
        if (!$payment->transaction_id) {
            return response()->json(['message' => 'Missing transaction id'], 422);
        }

        try {
            $verification = $cinetPayService->verifyTransaction($payment->transaction_id);
            $normalized = $cinetPayService->normalizeStatus($verification);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Verification failed'], 502);
        }

        DB::transaction(function () use ($payment, $normalized, $verification) {
            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['resync'] = $verification;

            $payment->update([
                'status' => $normalized,
                'webhook_data' => $meta,
            ]);

            if ($payment->order) {
                $payment->order->update([
                    'status' => $normalized === 'completed' ? 'paid' : ($normalized === 'failed' ? 'failed' : $payment->order->status),
                ]);
            }

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $payment->transaction_id],
                [
                    'order_id' => $payment->order_id,
                    'amount' => (float) $payment->amount,
                    'currency' => strtoupper((string) ($payment->order->currency ?? config('cinetpay.default_currency', 'XOF'))),
                    'status' => $normalized,
                    'provider' => 'cinetpay',
                    'processed_at' => now(),
                    'raw_payload' => [
                        'resync' => $verification,
                    ],
                ]
            );
        });

        $auditLogger->log(
            $request->user(),
            'payment_resync',
            [
                'payment_id' => $payment->id,
                'transaction_id' => $payment->transaction_id,
                'status' => $normalized,
            ],
            actionType: 'payments',
            request: $request
        );

        return response()->json([
            'data' => [
                'payment_id' => $payment->id,
                'transaction_id' => $payment->transaction_id,
                'status' => $normalized,
            ],
        ]);
    }
}

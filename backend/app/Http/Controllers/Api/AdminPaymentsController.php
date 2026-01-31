<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;
use App\Services\PaymentResyncService;

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

    public function resync(Request $request, Payment $payment, PaymentResyncService $paymentResyncService, AdminAuditLogger $auditLogger)
    {
        if (!$payment->transaction_id) {
            return response()->json(['message' => 'Missing transaction id'], 422);
        }

        try {
            $normalized = $paymentResyncService->resync($payment, [
                'source' => 'admin',
                'admin_user_id' => $request->user()?->id,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Verification failed'], 502);
        }

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

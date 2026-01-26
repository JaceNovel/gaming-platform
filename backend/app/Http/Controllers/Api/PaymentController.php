<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Order;
use App\Models\Payment;
use App\Services\CinetPayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    protected CinetPayService $cinetPayService;

    public function __construct(CinetPayService $cinetPayService)
    {
        $this->cinetPayService = $cinetPayService;
    }

    public function initCinetpay(Request $request)
    {
        $request->validate([
            'order_id' => 'required|exists:orders,id',
            'payment_method' => 'required|in:cinetpay',
        ]);

        $user = $request->user();
        $order = Order::with('payment', 'user')->findOrFail($request->order_id);

        if ($order->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($order->status !== 'pending') {
            return response()->json(['message' => 'Order is not in pending status'], 400);
        }

        if ($order->payment && in_array($order->payment->status, ['initiated', 'paid'])) {
            return response()->json(['message' => 'Payment already initiated'], 400);
        }

        try {
            $paymentUrl = null;
            $payment = DB::transaction(function () use ($order, &$paymentUrl) {
                $payment = Payment::create([
                    'order_id' => $order->id,
                    'amount' => $order->total_price,
                    'method' => 'cinetpay',
                    'status' => 'initiated',
                ]);

                $paymentUrl = $this->cinetPayService->initiatePayment($payment);

                $order->update(['payment_id' => $payment->id]);

                return $payment;
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'payment_url' => $paymentUrl,
                    'payment_id' => $payment->id,
                    'amount' => $payment->amount,
                    'currency' => 'XAF',
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('CinetPay initiation failed', ['error' => $e->getMessage(), 'order_id' => $order->id]);
            return response()->json(['message' => 'Payment initiation failed'], 500);
        }
    }

    public function webhookCinetpay(Request $request)
    {
        try {
            if (!$this->cinetPayService->validateWebhook($request->all())) {
                Log::warning('Invalid CinetPay webhook signature', $request->all());
                return response()->json(['success' => false, 'message' => 'Invalid signature'], 400);
            }

            $transactionId = $request->input('cpm_trans_id');
            $status = strtoupper($request->input('cpm_trans_status'));
            $amount = (float) $request->input('cpm_amount');

            $payment = Payment::with(['order.orderItems'])->where('transaction_id', $transactionId)->first();

            if (!$payment) {
                Log::warning('Payment not found for transaction', ['transaction_id' => $transactionId]);
                return response()->json(['message' => 'Payment not found'], 404);
            }

            if (in_array($payment->status, ['paid', 'failed'])) {
                Log::info('Webhook already processed', ['payment_id' => $payment->id, 'status' => $payment->status]);
                return response()->json(['success' => true, 'message' => 'Webhook already processed'], 200);
            }

            if ((float) $payment->amount !== $amount || (float) $payment->order->total_price !== $amount) {
                Log::error('Amount mismatch', [
                    'payment_amount' => $payment->amount,
                    'order_amount' => $payment->order->total_price,
                    'webhook_amount' => $amount,
                    'payment_id' => $payment->id,
                ]);
                return response()->json(['message' => 'Amount mismatch'], 400);
            }

            DB::transaction(function () use ($payment, $status, $request) {
                $isSuccess = $status === 'SUCCESS';
                $newStatus = $isSuccess ? 'paid' : 'failed';

                $payment->update([
                    'status' => $newStatus,
                    'webhook_data' => $request->all(),
                ]);

                $payment->order->update([
                    'status' => $isSuccess ? 'paid' : 'failed',
                ]);

                if ($isSuccess && $payment->order->type !== 'wallet_topup') {
                    $payment->order->loadMissing('orderItems');

                    if ($payment->order->requiresRedeemFulfillment()) {
                        ProcessRedeemFulfillment::dispatch($payment->order->id);
                    } else {
                        ProcessOrderDelivery::dispatch($payment->order);
                    }
                }
            });

            Log::info('Payment webhook processed', [
                'payment_id' => $payment->id,
                'status' => $status,
                'amount' => $amount,
            ]);

            return response()->json(['success' => true, 'message' => 'Webhook processed successfully']);
        } catch (\Throwable $e) {
            Log::error('Webhook processing failed', [
                'error' => $e->getMessage(),
                'request' => $request->all(),
            ]);
            return response()->json(['message' => 'Processing failed'], 500);
        }
    }

    public function webhook(Request $request)
    {
        return $this->webhookCinetpay($request);
    }
}
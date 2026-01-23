<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WalletTopupRequest;
use App\Models\AdminLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\WalletTransaction;
use App\Services\CinetPayService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WalletController extends Controller
{
    public function __construct(private WalletService $walletService, private CinetPayService $cinetPayService)
    {
    }

    public function show(Request $request)
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());
        $transactions = $wallet->transactions()->latest()->limit(10)->get();

        return response()->json([
            'balance' => $wallet->balance,
            'currency' => $wallet->currency,
            'status' => $wallet->status,
            'transactions' => $transactions,
        ]);
    }

    public function initTopup(WalletTopupRequest $request)
    {
        $user = $request->user();
        $amount = (float) $request->validated()['amount'];
        $wallet = $this->walletService->getOrCreateWallet($user);
        $reference = $this->walletService->generateReference('WTP');

        $paymentUrl = null;

        try {
            DB::transaction(function () use ($user, $amount, $wallet, $reference, &$paymentUrl) {
                $walletTx = WalletTransaction::create([
                    'wallet_account_id' => $wallet->id,
                    'type' => 'credit',
                    'amount' => $amount,
                    'reference' => $reference,
                    'meta' => ['reason' => 'topup'],
                    'status' => 'pending',
                ]);

                $order = Order::create([
                    'user_id' => $user->id,
                    'type' => 'wallet_topup',
                    'status' => 'pending',
                    'total_price' => $amount,
                    'items' => null,
                    'meta' => ['wallet_transaction_id' => $walletTx->id],
                    'reference' => $reference,
                ]);

                $payment = Payment::create([
                    'order_id' => $order->id,
                    'wallet_transaction_id' => $walletTx->id,
                    'amount' => $amount,
                    'method' => 'cinetpay',
                    'status' => 'initiated',
                ]);

                $paymentUrl = $this->cinetPayService->initiatePayment($payment, [
                    'notify_url' => route('api.wallet.topup.webhook'),
                    'description' => 'BADBOYSHOP Wallet Topup',
                ]);

                $order->update(['payment_id' => $payment->id]);
            });
        } catch (\Throwable $e) {
            Log::error('Topup init failed', ['error' => $e->getMessage(), 'user_id' => $user->id]);
            return response()->json(['message' => 'Payment initiation failed'], 500);
        }

        return response()->json([
            'payment_url' => $paymentUrl,
            'reference' => $reference,
        ]);
    }

    public function webhookTopup(Request $request)
    {
        try {
            if (!$this->cinetPayService->validateWebhook($request->all())) {
                Log::warning('Invalid CinetPay topup webhook signature', $request->all());
                return response()->json(['success' => false, 'message' => 'Invalid signature'], 400);
            }

            $transactionId = $request->input('cpm_trans_id');
            $status = strtoupper($request->input('cpm_trans_status'));
            $amount = (float) $request->input('cpm_amount');

            $payment = Payment::with(['order', 'walletTransaction', 'order.user'])
                ->where('transaction_id', $transactionId)
                ->first();

            if (!$payment) {
                Log::warning('Topup payment not found', ['transaction_id' => $transactionId]);
                return response()->json(['message' => 'Payment not found'], 404);
            }

            if ($payment->status === 'paid') {
                return response()->json(['success' => true, 'message' => 'Already processed']);
            }

            if ($payment->amount != $amount) {
                Log::error('Topup amount mismatch', ['payment' => $payment->amount, 'webhook' => $amount]);
                return response()->json(['message' => 'Amount mismatch'], 400);
            }

            DB::transaction(function () use ($payment, $status, $request) {
                $isSuccess = $status === 'SUCCESS';
                $payment->update([
                    'status' => $isSuccess ? 'paid' : 'failed',
                    'webhook_data' => $request->all(),
                ]);

                $order = $payment->order;
                $order->update(['status' => $isSuccess ? 'paid' : 'failed']);

                if ($isSuccess && $payment->walletTransaction) {
                    $this->walletService->credit($order->user, $payment->walletTransaction->reference, (float) $payment->amount, [
                        'source' => 'cinetpay_topup',
                        'payment_id' => $payment->id,
                    ]);
                } elseif (!$isSuccess && $payment->walletTransaction) {
                    $payment->walletTransaction->update(['status' => 'failed']);
                }

                AdminLog::create([
                    'admin_id' => null,
                    'action' => 'wallet_topup_webhook',
                    'details' => json_encode([
                        'payment_id' => $payment->id,
                        'order_id' => $order->id,
                        'status' => $payment->status,
                    ]),
                ]);
            });

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            Log::error('Topup webhook error', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Processing failed'], 500);
        }
    }
}

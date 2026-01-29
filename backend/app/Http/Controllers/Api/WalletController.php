<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WalletTopupRequest;
use App\Models\AdminLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\WalletTransaction;
use App\Services\CinetPayService;
use App\Services\FedaPayService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WalletController extends Controller
{
    public function __construct(
        private WalletService $walletService,
        private CinetPayService $cinetPayService,
        private FedaPayService $fedaPayService,
    )
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

    public function transactions(Request $request)
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());
        $limit = max(1, min(50, (int) $request->query('limit', 10)));

        $rows = $wallet->transactions()->latest('created_at')->limit($limit)->get();

        $transactions = $rows->map(function (WalletTransaction $tx) use ($wallet) {
            $meta = is_array($tx->meta) ? $tx->meta : [];
            $typeHint = strtolower((string) ($meta['type'] ?? $meta['reason'] ?? ''));

            $label = match (true) {
                $typeHint === 'topup' => 'Recharge wallet',
                $typeHint === 'order_refund' => 'Remboursement commande',
                $typeHint === 'admin_wallet_credit' => 'Crédit wallet (admin)',
                default => 'Transaction wallet',
            };

            return [
                'id' => $tx->id,
                'label' => $label,
                'amount' => (float) $tx->amount,
                'currency' => $wallet->currency,
                'created_at' => optional($tx->created_at)->toIso8601String(),
                'type' => $tx->type,
                'status' => $tx->status,
                'reference' => $tx->reference,
            ];
        })->values();

        return response()->json([
            'transactions' => $transactions,
        ]);
    }

    public function initTopup(WalletTopupRequest $request)
    {
        $user = $request->user();
        $email = trim((string) ($user->email ?? ''));
        if ($email === '') {
            return response()->json([
                'message' => 'Email requis pour effectuer le paiement.',
            ], 422);
        }
        $validated = $request->validated();
        $amount = (float) $validated['amount'];
        $wallet = $this->walletService->getOrCreateWallet($user);
        $reference = $this->walletService->generateReference('WTP');

        try {
            [$order, $payment, $walletTx] = DB::transaction(function () use ($user, $amount, $wallet, $reference) {
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
                    'method' => 'fedapay',
                    'status' => 'pending',
                ]);

                $order->update(['payment_id' => $payment->id]);

                return [$order->fresh(['payment', 'user']), $payment->fresh(), $walletTx];
            });

            $returnUrl = trim((string) ($validated['return_url'] ?? ''));
            $callbackUrl = null;

            if ($returnUrl !== '') {
                $callbackUrl = $returnUrl
                    . (str_contains($returnUrl, '?') ? '&' : '?')
                    . Arr::query([
                        'provider' => 'fedapay',
                        'order_id' => $order->id,
                    ]);
            } else {
                $frontUrl = rtrim((string) env('FRONTEND_URL', ''), '/');
                $callbackUrl = $frontUrl !== ''
                    ? $frontUrl . '/wallet/topup/return?' . Arr::query([
                        'provider' => 'fedapay',
                        'order_id' => $order->id,
                    ])
                    : null;
            }

            $initResult = $this->fedaPayService->initPayment($order, $user, [
                'amount' => $amount,
                'currency' => strtoupper((string) ($order->currency ?? config('fedapay.default_currency', 'XOF'))),
                'description' => 'BADBOYSHOP Wallet Topup',
                'callback_url' => $callbackUrl,
                'customer_email' => $email,
                'metadata' => [
                    'type' => 'wallet_topup',
                    'wallet_transaction_id' => $walletTx->id,
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                ],
            ]);

            $transactionId = (string) $initResult['transaction_id'];
            $payment->update(['transaction_id' => $transactionId]);

            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['init_response'] = $initResult['raw'] ?? null;

            $payment->update([
                'status' => 'pending',
                'webhook_data' => $meta,
            ]);

            return response()->json([
                'payment_url' => $initResult['payment_url'],
                'transaction_id' => $initResult['transaction_id'],
                'reference' => $reference,
            ]);
        } catch (\Throwable $e) {
            Log::error('Topup init failed', ['error' => $e->getMessage(), 'user_id' => $user->id]);
            return response()->json(['message' => 'Payment initiation failed'], 500);
        }
    }

    public function webhookTopup(Request $request)
    {
        $payload = $request->all();
        Log::info('cinetpay:webhook-topup', ['payload' => $payload]);

        if (!$this->cinetPayService->verifyWebhookSignature($payload)) {
            Log::warning('cinetpay:error', ['stage' => 'topup-webhook-signature', 'payload' => $payload]);
            return response()->json(['success' => false, 'message' => 'Invalid signature'], 400);
        }

        $transactionId = $request->input('transaction_id') ?? $request->input('cpm_trans_id');

        if (!$transactionId) {
            return response()->json(['message' => 'transaction_id missing'], 422);
        }

        $payment = Payment::with(['order.user', 'walletTransaction'])
            ->where('transaction_id', $transactionId)
            ->first();

        if (!$payment) {
            Log::warning('cinetpay:error', ['stage' => 'topup-webhook-missing', 'transaction_id' => $transactionId]);
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if (in_array($payment->status, ['completed', 'paid'], true)) {
            return response()->json(['success' => true, 'message' => 'Already processed']);
        }

        try {
            $verification = $this->cinetPayService->verifyTransaction($transactionId);
        } catch (\Throwable $e) {
            Log::error('cinetpay:error', [
                'stage' => 'topup-webhook-verify',
                'transaction_id' => $transactionId,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Verification failed'], 502);
        }

        $normalized = $this->cinetPayService->normalizeStatus($verification, strtoupper($request->input('cpm_trans_status')));

        if ($normalized === 'pending') {
            return response()->json(['success' => true, 'message' => 'Payment pending'], 202);
        }

        $amountFromProvider = (float) (Arr::get($verification, 'data.amount', $request->input('cpm_amount')));

        if (abs((float) $payment->amount - $amountFromProvider) > 0.01) {
            Log::error('cinetpay:error', [
                'stage' => 'topup-webhook-amount',
                'payment_id' => $payment->id,
                'expected' => $payment->amount,
                'received' => $amountFromProvider,
            ]);

            return response()->json(['message' => 'Amount mismatch'], 400);
        }

        try {
            DB::transaction(function () use ($payment, $normalized, $payload, $verification) {
                $meta = $payment->webhook_data ?? [];
                if (!is_array($meta)) {
                    $meta = [];
                }
                $meta['webhook'] = $payload;
                $meta['verification'] = $verification;

                $payment->update([
                    'status' => $normalized,
                    'webhook_data' => $meta,
                ]);

                $orderStatus = $normalized === 'completed' ? 'paid' : 'failed';
                $order = $payment->order;
                $order->update(['status' => $orderStatus]);

                if ($payment->walletTransaction) {
                    if ($normalized === 'completed') {
                        $this->walletService->credit($order->user, $payment->walletTransaction->reference, (float) $payment->amount, [
                            'source' => 'cinetpay_topup',
                            'payment_id' => $payment->id,
                        ]);
                    } else {
                        $payment->walletTransaction->update(['status' => 'failed']);
                    }
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
        } catch (\Throwable $e) {
            Log::error('Topup webhook error', ['error' => $e->getMessage(), 'payment_id' => $payment->id ?? null]);
            return response()->json(['message' => 'Processing failed'], 500);
        }

        return response()->json(['success' => true]);
    }
}

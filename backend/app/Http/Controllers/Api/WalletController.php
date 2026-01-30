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

use Illuminate\Validation\Rule;

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

        // Avoid accidental double charges: reuse a recent pending topup for the same user/amount.
        $existing = Payment::with(['order', 'walletTransaction'])
            ->where('method', 'fedapay')
            ->where('amount', $amount)
            ->where('status', 'pending')
            ->whereHas('order', function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->where('type', 'wallet_topup')
                    ->where('status', 'pending');
            })
            ->whereNotNull('transaction_id')
            ->where('created_at', '>=', now()->subMinutes(10))
            ->latest('id')
            ->first();

        if ($existing && $existing->order) {
            $existingMeta = $existing->webhook_data ?? [];
            if (!is_array($existingMeta)) {
                $existingMeta = [];
            }

            $existingUrl = (string) (
                Arr::get($existingMeta, 'init_response.payment_url')
                    ?? Arr::get($existingMeta, 'init_response.raw.payment_url')
                    ?? ''
            );

            if ($existingUrl !== '') {
                return response()->json([
                    'payment_url' => $existingUrl,
                    'transaction_id' => $existing->transaction_id,
                    'reference' => (string) ($existing->walletTransaction?->reference ?? $existing->order->reference ?? ''),
                    'order_id' => $existing->order->id,
                    'reused' => true,
                ]);
            }
        }

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

            // Use backend callback so the server can reconcile/credit immediately on redirect
            // even if the SPA doesn't load correctly on the client.
            $appUrl = rtrim((string) config('app.url', env('APP_URL', '')), '/');
            $callbackUrl = $appUrl !== ''
                ? $appUrl . '/api/wallet/topup/return?' . Arr::query([
                    'provider' => 'fedapay',
                    'order_id' => $order->id,
                ])
                : null;

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
                'order_id' => $order->id,
            ]);
        } catch (\Throwable $e) {
            Log::error('Topup init failed', ['error' => $e->getMessage(), 'user_id' => $user->id]);
            return response()->json(['message' => 'Payment initiation failed'], 500);
        }
    }

    public function reconcileTopup(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id')],
            'transaction_id' => ['nullable', 'string', 'max:191'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $user = $request->user();

        $baseQuery = Payment::with(['order.user', 'walletTransaction'])
            ->where('method', 'fedapay')
            ->whereHas('order', function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->where('type', 'wallet_topup');
            });

        $limit = (int) ($validated['limit'] ?? 5);

        $payments = collect();
        if (!empty($validated['transaction_id'])) {
            $one = (clone $baseQuery)
                ->where('transaction_id', $validated['transaction_id'])
                ->latest('id')
                ->first();
            if ($one) {
                $payments = collect([$one]);
            }
        }

        if ($payments->isEmpty() && !empty($validated['order_id'])) {
            $one = (clone $baseQuery)
                ->where('order_id', (int) $validated['order_id'])
                ->latest('id')
                ->first();
            if ($one) {
                $payments = collect([$one]);
            }
        }

        if ($payments->isEmpty()) {
            $payments = (clone $baseQuery)
                ->whereNotIn('status', ['completed', 'failed'])
                ->whereNotNull('transaction_id')
                ->latest('id')
                ->limit($limit)
                ->get();
        }

        if ($payments->isEmpty()) {
            return response()->json([
                'status' => 'none',
                'message' => 'No pending topup found',
            ]);
        }

        $results = [];
        $counts = ['completed' => 0, 'failed' => 0, 'pending' => 0, 'error' => 0];

        foreach ($payments as $payment) {
            /** @var \App\Models\Payment $payment */
            $order = $payment->order;
            $reference = (string) ($payment->walletTransaction?->reference ?? $order?->reference ?? '');
            $txId = (string) ($payment->transaction_id ?? '');

            if ($txId === '') {
                $counts['error'] += 1;
                $results[] = [
                    'order_id' => $payment->order_id,
                    'transaction_id' => null,
                    'status' => $payment->status,
                    'error' => 'missing_transaction_id',
                ];
                continue;
            }

            if (in_array($payment->status, ['completed', 'failed'], true)) {
                $counts[$payment->status] += 1;
                $results[] = [
                    'order_id' => $payment->order_id,
                    'transaction_id' => $txId,
                    'status' => $payment->status,
                ];
                continue;
            }

            try {
                $verification = $this->fedaPayService->retrieveTransaction($txId);
                $normalized = $this->fedaPayService->normalizeStatus($verification);

                $amountFromProvider = (float) (
                    Arr::get($verification, 'amount')
                        ?? Arr::get($verification, 'data.amount')
                        ?? Arr::get($verification, 'transaction.amount')
                        ?? Arr::get($verification, 'data.transaction.amount')
                        ?? 0
                );

                if ($normalized === 'pending') {
                    $counts['pending'] += 1;
                    $results[] = [
                        'order_id' => $payment->order_id,
                        'transaction_id' => $txId,
                        'status' => 'pending',
                    ];
                    continue;
                }

                DB::transaction(function () use ($payment, $order, $normalized, $verification, $amountFromProvider, $reference) {
                    $meta = $payment->webhook_data ?? [];
                    if (!is_array($meta)) {
                        $meta = [];
                    }
                    $meta['reconcile_verification'] = $verification;

                    $payment->update([
                        'status' => $normalized,
                        'webhook_data' => $meta,
                    ]);

                    if ($order) {
                        $order->update([
                            'status' => $normalized === 'completed'
                                ? 'paid'
                                : ($normalized === 'failed' ? 'failed' : $order->status),
                        ]);

                        if ($normalized === 'completed' && $order->user && $reference !== '') {
                            if ($amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) > 0.01) {
                                Log::error('fedapay:error', [
                                    'stage' => 'topup-reconcile-amount',
                                    'payment_id' => $payment->id,
                                    'expected' => (float) $payment->amount,
                                    'received' => $amountFromProvider,
                                ]);
                            } else {
                                $this->walletService->credit($order->user, $reference, (float) $payment->amount, [
                                    'source' => 'fedapay_topup_reconcile',
                                    'payment_id' => $payment->id,
                                    'reason' => 'topup',
                                ]);

                                $orderMeta = $order->meta ?? [];
                                if (!is_array($orderMeta)) {
                                    $orderMeta = [];
                                }
                                if (empty($orderMeta['wallet_credited_at'])) {
                                    $orderMeta['wallet_credited_at'] = now()->toIso8601String();
                                    $order->update(['meta' => $orderMeta]);
                                }
                            }
                        }

                        if ($normalized === 'failed' && $payment->walletTransaction) {
                            $payment->walletTransaction->update(['status' => 'failed']);
                        }
                    }

                    AdminLog::create([
                        'admin_id' => null,
                        'action' => 'wallet_topup_reconcile',
                        'details' => json_encode([
                            'payment_id' => $payment->id,
                            'order_id' => $payment->order_id,
                            'status' => $normalized,
                        ]),
                    ]);
                });

                $counts[$normalized] += 1;
                $results[] = [
                    'order_id' => $payment->order_id,
                    'transaction_id' => $txId,
                    'status' => $normalized,
                ];
            } catch (\Throwable $e) {
                $counts['error'] += 1;
                Log::error('fedapay:error', [
                    'stage' => 'topup-reconcile',
                    'payment_id' => $payment->id,
                    'message' => $e->getMessage(),
                ]);
                $results[] = [
                    'order_id' => $payment->order_id,
                    'transaction_id' => $txId,
                    'status' => 'pending',
                    'error' => 'verification_failed',
                ];
            }
        }

        return response()->json([
            'status' => $counts['completed'] > 0 ? 'completed' : ($counts['failed'] > 0 ? 'failed' : 'pending'),
            'counts' => $counts,
            'results' => $results,
        ], $counts['error'] > 0 ? 202 : 200);
    }

    /**
     * Public return endpoint for FedaPay topups.
     * FedaPay redirects the user here after payment (browser redirect, not a webhook).
     * We verify with the provider, update DB, credit wallet idempotently, then redirect to frontend.
     */
    public function redirectTopupReturn(Request $request)
    {
        $orderId = (int) ($request->query('order_id') ?? $request->input('order_id') ?? 0);
        $transactionId = (string) (
            $request->query('transaction_id')
                ?? $request->query('id')
                ?? $request->input('transaction_id')
                ?? $request->input('id')
                ?? ''
        );

        $frontUrl = rtrim((string) env('FRONTEND_URL', ''), '/');
        $fallbackRedirect = $frontUrl !== '' ? $frontUrl . '/wallet/topup/return' : '/';

        try {
            $paymentQuery = Payment::with(['order.user', 'walletTransaction'])
                ->where('method', 'fedapay')
                ->whereHas('order', function ($q) {
                    $q->where('type', 'wallet_topup');
                });

            $payment = null;
            if ($transactionId !== '') {
                $payment = (clone $paymentQuery)->where('transaction_id', $transactionId)->latest('id')->first();
            }
            if (!$payment && $orderId > 0) {
                $payment = (clone $paymentQuery)->where('order_id', $orderId)->latest('id')->first();
            }

            if ($payment && $payment->transaction_id) {
                $verification = $this->fedaPayService->retrieveTransaction((string) $payment->transaction_id);
                $normalized = $this->fedaPayService->normalizeStatus($verification);

                if ($normalized !== 'pending') {
                    $amountFromProvider = (float) (
                        Arr::get($verification, 'amount')
                            ?? Arr::get($verification, 'data.amount')
                            ?? Arr::get($verification, 'transaction.amount')
                            ?? Arr::get($verification, 'data.transaction.amount')
                            ?? 0
                    );

                    DB::transaction(function () use ($payment, $normalized, $verification, $amountFromProvider) {
                        $meta = $payment->webhook_data ?? [];
                        if (!is_array($meta)) {
                            $meta = [];
                        }
                        $meta['return_verification'] = $verification;

                        $payment->update([
                            'status' => $normalized,
                            'webhook_data' => $meta,
                        ]);

                        $order = $payment->order;
                        if ($order) {
                            $order->update([
                                'status' => $normalized === 'completed'
                                    ? 'paid'
                                    : ($normalized === 'failed' ? 'failed' : $order->status),
                            ]);

                            if ($normalized === 'completed' && $order->user) {
                                $reference = (string) ($payment->walletTransaction?->reference ?? $order->reference ?? '');
                                if ($reference !== '') {
                                    if ($amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) > 0.01) {
                                        Log::error('fedapay:error', [
                                            'stage' => 'topup-return-amount',
                                            'payment_id' => $payment->id,
                                            'expected' => (float) $payment->amount,
                                            'received' => $amountFromProvider,
                                        ]);
                                    } else {
                                        $this->walletService->credit($order->user, $reference, (float) $payment->amount, [
                                            'source' => 'fedapay_topup_return',
                                            'payment_id' => $payment->id,
                                            'reason' => 'topup',
                                        ]);

                                        $orderMeta = $order->meta ?? [];
                                        if (!is_array($orderMeta)) {
                                            $orderMeta = [];
                                        }
                                        if (empty($orderMeta['wallet_credited_at'])) {
                                            $orderMeta['wallet_credited_at'] = now()->toIso8601String();
                                            $order->update(['meta' => $orderMeta]);
                                        }
                                    }
                                }
                            }

                            if ($normalized === 'failed' && $payment->walletTransaction) {
                                $payment->walletTransaction->update(['status' => 'failed']);
                            }
                        }
                    });
                }

                $transactionId = (string) $payment->transaction_id;
                $orderId = (int) ($payment->order_id ?? $orderId);
            }
        } catch (\Throwable $e) {
            Log::warning('fedapay:error', [
                'stage' => 'topup-return',
                'message' => $e->getMessage(),
                'order_id' => $orderId,
                'transaction_id' => $transactionId,
            ]);
        }

        $qs = Arr::query(array_filter([
            'provider' => 'fedapay',
            'order_id' => $orderId > 0 ? (string) $orderId : null,
            'transaction_id' => $transactionId !== '' ? $transactionId : null,
        ], fn ($v) => $v !== null && $v !== ''));

        $redirect = $fallbackRedirect . ($qs ? ('?' . $qs) : '');
        return redirect()->away($redirect);
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

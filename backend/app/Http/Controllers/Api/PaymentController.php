<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use App\Models\PremiumMembership;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\CinetPayService;
use App\Services\FedaPayService;
use App\Services\PaymentResyncService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class PaymentController extends Controller
{
    public function __construct(
        private CinetPayService $cinetPayService,
        private FedaPayService $fedaPayService,
        private PaymentResyncService $paymentResyncService,
    )
    {
    }

    public function initFedapay(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', Rule::exists('orders', 'id')],
            'payment_method' => ['nullable', Rule::in(['fedapay'])],
            'amount' => ['required', 'numeric', 'min:100'],
            'currency' => ['required', 'string', 'size:3'],
            'customer_phone' => ['nullable', 'string', 'max:32'],
            'customer_email' => ['nullable', 'email'],
            'description' => ['nullable', 'string', 'max:191'],
            'customer_name' => ['nullable', 'string', 'max:191'],
            'callback_url' => ['nullable', 'url', 'max:2048'],
            'metadata' => ['sometimes', 'array'],
        ]);

        $user = $request->user();

        $order = Order::with(['payment', 'user'])
            ->where('id', $validated['order_id'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ((string) $order->status !== Order::STATUS_PAYMENT_PROCESSING) {
            return response()->json(['message' => 'Order is not payable'], 400);
        }

        if ($order->payment && $order->payment->status === 'completed') {
            return response()->json(['message' => 'Order already paid'], 400);
        }

        $expectedAmount = (float) $order->total_price;
        $payloadAmount = (float) $validated['amount'];

        if (abs($expectedAmount - $payloadAmount) > 0.01) {
            return response()->json(['message' => 'Amount mismatch'], 422);
        }

        $currency = strtoupper($validated['currency']);
        $defaultCurrency = strtoupper(config('fedapay.default_currency', 'XOF'));

        if ($currency !== $defaultCurrency) {
            return response()->json(['message' => 'Unsupported currency'], 422);
        }

        $resolvedEmail = trim((string) ($validated['customer_email'] ?? $user->email ?? ''));
        if ($resolvedEmail === '') {
            return response()->json([
                'message' => 'Email requis pour effectuer le paiement.',
            ], 422);
        }

        $rawPhone = trim((string) ($validated['customer_phone'] ?? ''));
        $digits = preg_replace('/\D+/', '', $rawPhone) ?? '';
        $allZeros = $digits !== '' && preg_match('/^0+$/', $digits);
        $resolvedPhone = ($digits !== '' && !$allZeros && strlen($digits) >= 6) ? $rawPhone : null;

        try {
            $payment = DB::transaction(function () use ($order, $expectedAmount) {
                $payment = $order->payment ?? new Payment();

                $payment->fill([
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'method' => 'fedapay',
                ]);

                $payment->status = 'pending';
                $payment->save();

                $order->payment_id = $payment->id;
                $order->save();

                return $payment->fresh(['order']);
            });

            // Use backend callback so the server can reconcile/fulfill immediately on redirect
            // even if the SPA doesn't load correctly on the client.
            $appUrl = rtrim((string) config('app.url', env('APP_URL', '')), '/');
            $callbackUrl = $appUrl !== ''
                ? $appUrl . '/api/payments/fedapay/return?' . Arr::query([
                    'order_id' => $order->id,
                    'provider' => 'fedapay',
                ])
                : null;

            $initResult = $this->fedaPayService->initPayment($order, $user, [
                'amount' => $expectedAmount,
                'currency' => $currency,
                'description' => $validated['description'] ?? null,
                'customer_name' => $validated['customer_name'] ?? null,
                'customer_phone' => $resolvedPhone,
                'customer_email' => $resolvedEmail,
                'callback_url' => $callbackUrl,
                'merchant_reference' => (string) ($order->reference ?? ''),
                'metadata' => array_merge($validated['metadata'] ?? [], [
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                ]),
            ]);

            $transactionId = (string) $initResult['transaction_id'];

            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['init_response'] = $initResult['raw'] ?? null;

            $payment->update([
                'status' => 'pending',
                'transaction_id' => $transactionId,
                'webhook_data' => $meta,
            ]);

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $transactionId],
                [
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'currency' => $currency,
                    'status' => 'pending',
                    'provider' => 'fedapay',
                    'raw_payload' => [
                        'init_request' => [
                            'order_id' => $order->id,
                            'amount' => $expectedAmount,
                            'currency' => $currency,
                        ],
                        'init_response' => $initResult['raw'] ?? null,
                    ],
                ]
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'payment_url' => $initResult['payment_url'],
                    'transaction_id' => $transactionId,
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'currency' => $currency,
                    'status' => $payment->status,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('fedapay:error', [
                'stage' => 'init-controller',
                'order_id' => $validated['order_id'] ?? null,
                'message' => $e->getMessage(),
            ]);

            $message = $e->getMessage();
            if (str_contains($message, 'FedaPay not configured')) {
                return response()->json(['message' => $message], 500);
            }

            if ((bool) config('app.debug')) {
                return response()->json([
                    'message' => 'Payment initiation failed',
                    'details' => $message,
                ], 502);
            }

            return response()->json(['message' => 'Payment initiation failed'], 502);
        }
    }

    /**
     * Public return endpoint for FedaPay.
     * Browser redirect is NOT a payment proof. We never validate nor fulfill here.
     * The ONLY source of truth is the signed server webhook.
     */
    public function redirectFedapayReturn(Request $request)
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
        $fallbackRedirect = $frontUrl !== ''
            ? $frontUrl . '/order-confirmation' . ($orderId > 0 ? ('?order=' . $orderId) : '')
            : '/';

        // Intentionally no provider verification and no DB writes here.

        $redirect = $frontUrl !== ''
            ? $frontUrl . '/order-confirmation' . ($orderId > 0 ? ('?order=' . $orderId) : '')
            : $fallbackRedirect;

        return redirect()->away($redirect);
    }

    public function statusFedapay(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id'), 'required_without:transaction_id'],
            'transaction_id' => ['nullable', 'string', 'max:191', 'required_without:order_id'],
        ]);

        $user = $request->user();

        $baseQuery = Payment::with(['order.user', 'walletTransaction'])
            ->where('method', 'fedapay')
            ->whereHas('order', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            });

        $payment = null;
        if (!empty($validated['transaction_id'])) {
            $payment = (clone $baseQuery)
                ->where('transaction_id', $validated['transaction_id'])
                ->latest('id')
                ->first();
        }

        if (!$payment && !empty($validated['order_id'])) {
            $payment = (clone $baseQuery)
                ->where('order_id', $validated['order_id'])
                ->latest('id')
                ->first();
        }

        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        $order = $payment->order;
        if (!$order) {
            return response()->json(['message' => 'Order not found for payment'], 404);
        }

        // Best-effort resync with provider (webhook may be delayed).
        try {
            if (!$order->isPaymentSuccess() && !$order->isPaymentFailed() && (string) ($payment->status ?? '') === 'pending' && $payment->transaction_id) {
                $this->paymentResyncService->resync($payment, [
                    'source' => 'status_endpoint',
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                ]);

                $payment = $payment->fresh(['order.user', 'walletTransaction']);
                $order = $payment?->order;
            }
        } catch (\Throwable $e) {
            Log::warning('fedapay:status-resync-failed', [
                'order_id' => $order?->id,
                'payment_id' => $payment->id,
                'transaction_id' => $payment->transaction_id,
                'message' => $e->getMessage(),
            ]);
        }

        $paymentStatus = $order->isPaymentSuccess() ? 'paid' : ($order->isPaymentFailed() ? 'failed' : 'processing');

        return response()->json([
            'success' => true,
            'data' => [
                'payment_status' => $paymentStatus,
                'order_status' => $order->status,
                'order_type' => $order->type,
                'transaction_id' => $payment->transaction_id,
                'order_id' => $payment->order_id,
            ],
        ]);
    }

    public function payWithWallet(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', Rule::exists('orders', 'id')],
        ]);

        $user = $request->user();
        $order = Order::with(['orderItems.product', 'payment'])
            ->where('id', $validated['order_id'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ((string) ($order->type ?? '') === 'wallet_topup') {
            return response()->json(['message' => 'Wallet topup cannot be paid with wallet'], 422);
        }

        if ((string) $order->status !== Order::STATUS_PAYMENT_PROCESSING) {
            return response()->json(['message' => 'Order is not payable'], 400);
        }

        $amount = (float) ($order->total_price ?? 0);
        if (!is_finite($amount) || $amount <= 0) {
            return response()->json(['message' => 'Invalid order amount'], 422);
        }
        $reference = 'WPAY-' . ($order->reference ?? $order->id);

        $isRechargeProduct = function (?Product $product): bool {
            if (!$product) return false;
            $type = strtolower((string) ($product->type ?? ''));
            $category = strtolower((string) ($product->category ?? ''));
            return in_array($type, ['recharge', 'topup', 'pass'], true)
                || str_contains($category, 'recharge');
        };

        $isRechargeOnlyOrder = (function () use ($order, $isRechargeProduct): bool {
            $items = $order->orderItems ?? [];
            if (count($items) === 0) return false;
            foreach ($items as $item) {
                $product = $item?->product;
                if (!$isRechargeProduct($product)) {
                    return false;
                }
            }
            return true;
        })();

        try {
            $result = DB::transaction(function () use ($user, $order, $amount, $reference, $isRechargeOnlyOrder) {
                /** @var WalletAccount $wallet */
                $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
                if (!$wallet) {
                    $wallet = WalletAccount::create([
                        'user_id' => $user->id,
                        'wallet_id' => 'DBW-' . (string) \Illuminate\Support\Str::ulid(),
                        'currency' => 'FCFA',
                        'balance' => 0,
                        'bonus_balance' => 0,
                        'bonus_expires_at' => null,
                        'status' => 'active',
                    ]);
                    $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
                }

                // Ensure legacy wallets get a wallet_id.
                if (empty($wallet->wallet_id)) {
                    $wallet->wallet_id = 'DBW-' . (string) \Illuminate\Support\Str::ulid();
                    $wallet->save();
                    $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
                }

                if ((string) ($wallet->status ?? '') === 'locked') {
                    return ['ok' => false, 'message' => 'Wallet locked', 'status' => 423];
                }

                // Expired bonus is not usable.
                if (!empty($wallet->bonus_expires_at) && $wallet->bonus_expires_at->isPast() && (float) ($wallet->bonus_balance ?? 0) > 0) {
                    $wallet->bonus_balance = 0;
                    $wallet->save();
                    $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
                }

                $balance = (float) ($wallet->balance ?? 0);

                $bonusBalance = (float) ($wallet->bonus_balance ?? 0);
                $bonusIsActive = $isRechargeOnlyOrder
                    && $bonusBalance > 0
                    && !empty($wallet->bonus_expires_at)
                    && $wallet->bonus_expires_at->isFuture();

                $available = $balance + ($bonusIsActive ? $bonusBalance : 0);
                if ($available + 0.0001 < $amount) {
                    return ['ok' => false, 'message' => 'Solde wallet insuffisant pour payer cette commande.', 'status' => 422];
                }

                $bonusUsed = 0.0;
                $balanceUsed = $amount;
                if ($bonusIsActive) {
                    $bonusUsed = min($bonusBalance, $amount);
                    $balanceUsed = max(0.0, $amount - $bonusUsed);
                }

                if ($balance + 0.0001 < $balanceUsed) {
                    // Should not happen if $available check passed, but keep it safe.
                    return ['ok' => false, 'message' => 'Solde wallet insuffisant pour payer cette commande.', 'status' => 422];
                }

                $existingTx = WalletTransaction::where('reference', $reference)->lockForUpdate()->first();
                if ($existingTx && (string) $existingTx->status === 'success') {
                    // Already paid with wallet.
                } else {
                    if (!$existingTx) {
                        $existingTx = WalletTransaction::create([
                            'wallet_account_id' => $wallet->id,
                            'type' => 'debit',
                            'amount' => $amount,
                            'reference' => $reference,
                            'meta' => [
                                'type' => 'order_wallet_payment',
                                'order_id' => $order->id,
                                'wallet_balance_used' => $balanceUsed,
                                'bonus_balance_used' => $bonusUsed,
                            ],
                            'status' => 'pending',
                        ]);
                    }

                    if ($bonusUsed > 0) {
                        $wallet->bonus_balance = max(0.0, (float) $wallet->bonus_balance - $bonusUsed);
                    }

                    $wallet->balance = (float) $wallet->balance - $balanceUsed;
                    $wallet->save();

                    $existingTx->status = 'success';
                    $existingTx->save();
                }

                $payment = $order->payment ?? new Payment();
                $payment->fill([
                    'order_id' => $order->id,
                    'wallet_transaction_id' => $existingTx->id,
                    'amount' => $amount,
                    'method' => 'wallet',
                    'status' => 'completed',
                    'transaction_id' => $reference,
                    'webhook_data' => [
                        'source' => 'wallet',
                    ],
                ]);
                $payment->save();

                $order->payment_id = $payment->id;
                $order->status = Order::STATUS_PAYMENT_SUCCESS;

                $orderMeta = $order->meta ?? [];
                if (!is_array($orderMeta)) {
                    $orderMeta = [];
                }

                if ((string) ($order->type ?? '') === 'premium_subscription' && empty($orderMeta['premium_activated_at'])) {
                    $level = (string) ($orderMeta['premium_level'] ?? 'bronze');
                    $gameId = (int) ($orderMeta['game_id'] ?? 0);
                    $gameUsername = (string) ($orderMeta['game_username'] ?? '');

                    if ($gameId > 0 && $gameUsername !== '') {
                        $levels = [
                            'bronze' => ['duration' => 30],
                            'platine' => ['duration' => 30],
                        ];
                        $duration = $levels[$level]['duration'] ?? 30;

                        $membership = PremiumMembership::updateOrCreate(
                            [
                                'user_id' => $order->user_id,
                                'game_id' => $gameId,
                            ],
                            [
                                'level' => $level,
                                'game_username' => $gameUsername,
                                'expiration_date' => Carbon::now()->addDays($duration),
                                'is_active' => true,
                                'renewal_count' => DB::raw('renewal_count + 1'),
                            ]
                        );

                        $order->loadMissing('user');
                        $order->user?->update([
                            'is_premium' => true,
                            'premium_level' => $level,
                            'premium_expiration' => $membership->expiration_date,
                        ]);

                        $orderMeta['premium_activated_at'] = now()->toIso8601String();
                    }
                }

                if (empty($orderMeta['sales_recorded_at'])) {
                    foreach ($order->orderItems as $item) {
                        if (!$item?->product_id) {
                            continue;
                        }
                        $qty = max(1, (int) ($item->quantity ?? 1));
                        Product::where('id', $item->product_id)->increment('purchases_count');
                        Product::where('id', $item->product_id)->increment('sold_count', $qty);
                    }
                    $orderMeta['sales_recorded_at'] = now()->toIso8601String();
                }

                if (empty($orderMeta['fulfillment_dispatched_at'])) {
                    if ((string) ($order->type ?? '') !== 'premium_subscription') {
                        if ($order->requiresRedeemFulfillment()) {
                            ProcessRedeemFulfillment::dispatchSync($order->id);
                        } else {
                            ProcessOrderDelivery::dispatchSync($order);
                        }
                        $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                    }
                }

                $orderMeta['wallet_paid_at'] = $orderMeta['wallet_paid_at'] ?? now()->toIso8601String();
                $order->meta = $orderMeta;
                $order->save();

                return [
                    'ok' => true,
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'wallet_balance' => (float) $wallet->refresh()->balance,
                    'bonus_balance' => (float) $wallet->refresh()->bonus_balance,
                ];
            });

            if (!($result['ok'] ?? false)) {
                return response()->json(['message' => $result['message'] ?? 'Wallet payment failed'], (int) ($result['status'] ?? 422));
            }

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('wallet:pay:error', [
                'stage' => 'wallet-pay',
                'order_id' => $order->id ?? null,
                'user_id' => $user->id ?? null,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Wallet payment failed'], 500);
        }
    }

    public function init(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', Rule::exists('orders', 'id')],
            'payment_method' => ['required', Rule::in(['cinetpay'])],
            'amount' => ['required', 'numeric', 'min:100'],
            'currency' => ['required', 'string', 'size:3'],
            'transaction_id' => ['nullable', 'string', 'max:191'],
            'customer_phone' => ['nullable', 'string', 'max:32'],
            'customer_email' => ['nullable', 'email'],
            'description' => ['nullable', 'string', 'max:191'],
            'customer_name' => ['nullable', 'string', 'max:191'],
            'notify_url' => ['nullable', 'url', 'max:2048'],
            'return_url' => ['nullable', 'url', 'max:2048'],
            'cancel_url' => ['nullable', 'url', 'max:2048'],
            'channels' => ['nullable', 'string', 'max:50'],
            'metadata' => ['sometimes', 'array'],
        ]);

        $user = $request->user();

        $order = Order::with(['payment', 'user'])
            ->where('id', $validated['order_id'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ((string) $order->status !== Order::STATUS_PAYMENT_PROCESSING) {
            return response()->json(['message' => 'Order is not payable'], 400);
        }

        if ($order->payment && $order->payment->status === 'completed') {
            return response()->json(['message' => 'Order already paid'], 400);
        }

        $expectedAmount = (float) $order->total_price;
        $payloadAmount = (float) $validated['amount'];

        if (abs($expectedAmount - $payloadAmount) > 0.01) {
            return response()->json(['message' => 'Amount mismatch'], 422);
        }

        $currency = strtoupper($validated['currency']);
        $defaultCurrency = strtoupper(config('cinetpay.default_currency', 'XOF'));

        if ($currency !== $defaultCurrency) {
            return response()->json(['message' => 'Unsupported currency'], 422);
        }

        $transactionId = $order->payment?->transaction_id
            ?? ($validated['transaction_id'] ?? null)
            ?? $this->cinetPayService->generateTransactionId($order);

        try {
            $payment = DB::transaction(function () use ($order, $transactionId, $expectedAmount, $currency) {
                $payment = $order->payment ?? new Payment();

                $payment->fill([
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'method' => 'cinetpay',
                ]);

                $payment->transaction_id = $transactionId;
                $payment->status = 'pending';
                $payment->save();

                $order->payment_id = $payment->id;
                $order->save();

                PaymentAttempt::updateOrCreate(
                    ['transaction_id' => $transactionId],
                    [
                        'order_id' => $order->id,
                        'amount' => $expectedAmount,
                        'currency' => $currency,
                        'status' => 'pending',
                        'provider' => 'cinetpay',
                    ]
                );

                return $payment->fresh(['order']);
            });

            $initResult = $this->cinetPayService->initPayment($order, $user, [
                'transaction_id' => $transactionId,
                'amount' => $expectedAmount,
                'currency' => $currency,
                'description' => $validated['description'] ?? null,
                'customer_name' => $validated['customer_name'] ?? null,
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_email' => $validated['customer_email'] ?? $user->email,
                'notify_url' => $validated['notify_url'] ?? route('api.payments.cinetpay.webhook'),
                'return_url' => $validated['return_url'] ?? route('api.payments.cinetpay.return', [
                        'order_id' => $order->id,
                        'transaction_id' => $transactionId,
                    ]),
                'cancel_url' => $validated['cancel_url'] ?? config('cinetpay.cancel_url'),
                'channels' => $validated['channels'] ?? null,
                'metadata' => array_merge($validated['metadata'] ?? [], [
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                ]),
            ]);

            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['init_response'] = $initResult['raw'] ?? null;

            $payment->update([
                'status' => 'pending',
                'webhook_data' => $meta,
            ]);

            PaymentAttempt::where('transaction_id', $transactionId)->update([
                'raw_payload' => [
                    'init_request' => [
                        'order_id' => $order->id,
                        'amount' => $expectedAmount,
                        'currency' => $currency,
                    ],
                    'init_response' => $initResult['raw'] ?? null,
                ],
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'payment_url' => $initResult['payment_url'],
                    'transaction_id' => $initResult['transaction_id'],
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'currency' => $currency,
                    'status' => $payment->status,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('cinetpay:error', [
                'stage' => 'init-controller',
                'order_id' => $order->id,
                'message' => $e->getMessage(),
            ]);

            $message = $e->getMessage();
            if (str_contains($message, 'CinetPay not configured')) {
                return response()->json(['message' => $message], 500);
            }

            return response()->json(['message' => 'Payment initiation failed'], 502);
        }
    }

    public function status(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id'), 'required_without:transaction_id'],
            'transaction_id' => ['nullable', 'string', 'max:191', 'required_without:order_id'],
        ]);

        $user = $request->user();

        $baseQuery = Payment::with(['order.user', 'walletTransaction'])
                ->whereHas('order', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            });

        $payment = null;
        if (!empty($validated['transaction_id'])) {
            $payment = (clone $baseQuery)
                ->where('transaction_id', $validated['transaction_id'])
                ->latest('id')
                ->first();
        }

        if (!$payment && !empty($validated['order_id'])) {
            $payment = (clone $baseQuery)
                ->where('order_id', $validated['order_id'])
                ->latest('id')
                ->first();
        }

        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        $order = $payment->order;
        if (!$order) {
            return response()->json(['message' => 'Order not found for payment'], 404);
        }

        $paymentStatus = $order->isPaymentSuccess() ? 'paid' : ($order->isPaymentFailed() ? 'failed' : 'processing');

        return response()->json([
            'success' => true,
            'data' => [
                'payment_status' => $paymentStatus,
                'order_status' => $order->status,
                'order_type' => $order->type,
                'transaction_id' => $payment->transaction_id,
                'order_id' => $payment->order_id,
            ],
        ]);
    }

    private function attachRedeemDenominationsIfMissing(Order $order): bool
    {
        $order->loadMissing(['orderItems.product']);

        $updated = false;

        foreach ($order->orderItems as $orderItem) {
            if (!empty($orderItem->redeem_denomination_id)) {
                continue;
            }

            $product = $orderItem->product;
            if (!$product) {
                continue;
            }

            $requiresDenomination = ($product->stock_mode ?? 'manual') === 'redeem_pool'
                || (bool) ($product->redeem_code_delivery ?? false)
                || strtolower((string) ($product->type ?? '')) === 'redeem';

            if (!$requiresDenomination) {
                continue;
            }

            $quantity = max(1, (int) ($orderItem->quantity ?? 1));

            // Prefer product-scoped denominations first to keep codes tied to the product.
            $denominations = RedeemDenomination::query()
                ->where('active', true)
                ->where('product_id', $product->id)
                ->orderByDesc('diamonds')
                ->orderBy('id')
                ->get();

            foreach ($denominations as $denomination) {
                $available = RedeemCode::where('denomination_id', $denomination->id)
                    ->where('status', 'available')
                    ->count();

                if ($available >= $quantity) {
                    $orderItem->update(['redeem_denomination_id' => $denomination->id]);
                    $updated = true;
                    break;
                }
            }
        }

        return $updated;
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessMarketplaceOrder;
use App\Jobs\ProcessRedeemFulfillment;
use App\Jobs\SendOrderPaidSms;
use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\SellerListing;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use App\Models\PremiumMembership;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\CinetPayService;
use App\Services\FedaPayService;
use App\Services\PayPalPaymentSyncService;
use App\Services\PayPalService;
use App\Services\PaymentResyncService;
use App\Services\ReferralCommissionService;
use App\Services\ShippingService;
use App\Services\SourcingDemandService;
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
        private PayPalService $payPalService,
        private PayPalPaymentSyncService $payPalPaymentSyncService,
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
        // FedaPay is strict about the format; send digits-only when available.
        $resolvedPhone = ($digits !== '' && !$allZeros && strlen($digits) >= 6) ? $digits : null;

        // Persist customer's phone on the order so it can be used for SMS after payment.
        if ($digits !== '' && !$allZeros && strlen($digits) >= 6) {
            $orderMeta = $order->meta ?? [];
            if (!is_array($orderMeta)) {
                $orderMeta = [];
            }

            $orderMeta['customer_phone'] = $digits;
            $order->meta = $orderMeta;
            if (empty($order->shipping_phone)) {
                $order->shipping_phone = $digits;
            }
            $order->save();
        }

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
        $orderType = $orderId > 0
            ? (string) (Order::query()->where('id', $orderId)->value('type') ?? '')
            : '';
        $isWalletTopup = $orderType === 'wallet_topup';

        $fallbackRedirect = $frontUrl !== ''
            ? ($isWalletTopup
                ? $frontUrl . '/wallet' . ($orderId > 0 ? ('?topup_order=' . $orderId) : '')
                : $frontUrl . '/order-confirmation' . ($orderId > 0 ? ('?order=' . $orderId) : ''))
            : '/';

        // Intentionally no provider verification and no DB writes here.

        $redirect = $frontUrl !== ''
            ? ($isWalletTopup
                ? $frontUrl . '/wallet' . ($orderId > 0 ? ('?topup_order=' . $orderId) : '')
                : $frontUrl . '/order-confirmation' . ($orderId > 0 ? ('?order=' . $orderId) : ''))
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

    public function initPaypal(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', Rule::exists('orders', 'id')],
            'payment_method' => ['nullable', Rule::in(['paypal'])],
            'amount' => ['required', 'numeric', 'min:100'],
            'currency' => ['required', 'string', 'size:3'],
            'customer_email' => ['nullable', 'email'],
            'description' => ['nullable', 'string', 'max:191'],
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

        $currency = strtoupper((string) $validated['currency']);
        if ($currency !== 'XOF') {
            return response()->json(['message' => 'Unsupported source currency for PayPal'], 422);
        }

        try {
            $payment = DB::transaction(function () use ($order, $expectedAmount) {
                $payment = $order->payment ?? new Payment();

                $payment->fill([
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'method' => 'paypal',
                ]);

                $payment->status = 'pending';
                $payment->save();

                $order->payment_id = $payment->id;
                $order->save();

                return $payment->fresh(['order']);
            });

            $initResult = $this->payPalService->createCheckoutOrder($order, $user, [
                'amount' => $expectedAmount,
                'source_currency' => 'XOF',
                'currency' => (string) config('paypal.default_currency', 'EUR'),
                'description' => $validated['description'] ?? null,
                'return_url' => route('api.payments.paypal.return', [
                    'order_id' => $order->id,
                ]),
                'cancel_url' => route('api.payments.paypal.return', [
                    'order_id' => $order->id,
                    'cancelled' => 1,
                ]),
            ]);

            $providerOrderId = (string) $initResult['order_id'];
            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['init_response'] = $initResult['raw'] ?? null;
            $meta['provider_currency'] = $initResult['provider_currency'] ?? null;
            $meta['provider_amount'] = $initResult['provider_amount'] ?? null;
            $meta['source_currency'] = 'XOF';
            $meta['source_amount'] = $expectedAmount;

            $payment->update([
                'status' => 'pending',
                'transaction_id' => $providerOrderId,
                'webhook_data' => $meta,
            ]);

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => $providerOrderId],
                [
                    'order_id' => $order->id,
                    'amount' => (float) ($initResult['provider_amount'] ?? 0),
                    'currency' => (string) ($initResult['provider_currency'] ?? config('paypal.default_currency', 'EUR')),
                    'status' => 'pending',
                    'provider' => 'paypal',
                    'raw_payload' => [
                        'init_request' => [
                            'order_id' => $order->id,
                            'source_amount' => $expectedAmount,
                            'source_currency' => 'XOF',
                        ],
                        'init_response' => $initResult['raw'] ?? null,
                    ],
                ]
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'payment_url' => $initResult['approve_url'],
                    'transaction_id' => $providerOrderId,
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'currency' => 'XOF',
                    'provider_amount' => $initResult['provider_amount'],
                    'provider_currency' => $initResult['provider_currency'],
                    'status' => $payment->status,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('paypal:error', [
                'stage' => 'init-controller',
                'order_id' => $validated['order_id'] ?? null,
                'message' => $e->getMessage(),
            ]);

            $message = $e->getMessage();
            if (str_contains($message, 'PayPal not configured')) {
                return response()->json(['message' => $message], 500);
            }

            return response()->json(['message' => 'PayPal initiation failed'], 502);
        }
    }

    public function redirectPaypalReturn(Request $request)
    {
        $orderId = (int) ($request->query('order_id') ?? $request->input('order_id') ?? 0);
        $cancelled = (bool) ($request->query('cancelled') ?? $request->input('cancelled') ?? false);
        $providerOrderId = trim((string) ($request->query('token') ?? $request->input('token') ?? ''));

        if ($orderId <= 0) {
            return redirect()->away($this->buildFrontendPaymentRedirect(null, 'failed'));
        }

        $payment = Payment::with(['order.user', 'walletTransaction'])
            ->where('method', 'paypal')
            ->where('order_id', $orderId)
            ->latest('id')
            ->first();

        $order = $payment?->order ?? Order::query()->find($orderId);
        if (!$payment || !$order) {
            return redirect()->away($this->buildFrontendPaymentRedirect($order, 'failed'));
        }

        if ($cancelled) {
            return redirect()->away($this->buildFrontendPaymentRedirect($order, 'cancelled'));
        }

        if ($providerOrderId === '' && !$order->isPaymentSuccess() && !$order->isPaymentFailed()) {
            return redirect()->away($this->buildFrontendPaymentRedirect($order, 'processing'));
        }

        if ($providerOrderId !== '' && $payment->transaction_id && $providerOrderId !== (string) $payment->transaction_id) {
            Log::warning('paypal:return-order-mismatch', [
                'payment_id' => $payment->id,
                'order_id' => $order->id,
                'expected' => $payment->transaction_id,
                'received' => $providerOrderId,
            ]);

            return redirect()->away($this->buildFrontendPaymentRedirect($order, 'failed'));
        }

        try {
            $this->payPalPaymentSyncService->sync($payment, true, ['source' => 'return_endpoint']);
            $payment = $payment->fresh(['order']);
            $order = $payment?->order ?? $order;
        } catch (\Throwable $e) {
            Log::warning('paypal:return-sync-failed', [
                'payment_id' => $payment->id,
                'order_id' => $order->id,
                'message' => $e->getMessage(),
            ]);
        }

        $status = $order?->isPaymentSuccess()
            ? 'paid'
            : ($order?->isPaymentFailed() ? 'failed' : 'processing');

        return redirect()->away($this->buildFrontendPaymentRedirect($order, $status));
    }

    public function statusPaypal(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id'), 'required_without:transaction_id'],
            'transaction_id' => ['nullable', 'string', 'max:191', 'required_without:order_id'],
        ]);

        $user = $request->user();

        $baseQuery = Payment::with(['order.user', 'walletTransaction'])
            ->where('method', 'paypal')
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

        try {
            if (!$order->isPaymentSuccess() && !$order->isPaymentFailed() && (string) ($payment->status ?? '') === 'pending' && $payment->transaction_id) {
                $this->payPalPaymentSyncService->sync($payment, true, [
                    'source' => 'status_endpoint',
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                ]);

                $payment = $payment->fresh(['order.user', 'walletTransaction']);
                $order = $payment?->order;
            }
        } catch (\Throwable $e) {
            Log::warning('paypal:status-sync-failed', [
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

        $minWalletBalance = 400.0;
        $reference = 'WPAY-' . ($order->reference ?? $order->id);

        try {
            $result = DB::transaction(function () use ($user, $order, $amount, $minWalletBalance, $reference) {
                /** @var WalletAccount $wallet */
                $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
                if (!$wallet) {
                    $wallet = WalletAccount::create([
                        'user_id' => $user->id,
                        'currency' => 'FCFA',
                        'balance' => 0,
                        'status' => 'active',
                    ]);
                    $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
                }

                if ((string) ($wallet->status ?? '') === 'locked') {
                    return ['ok' => false, 'message' => 'Wallet locked', 'status' => 423];
                }

                $balance = (float) ($wallet->balance ?? 0);
                if ($balance < $minWalletBalance) {
                    return ['ok' => false, 'message' => 'Solde wallet insuffisant (min 400 FCFA).', 'status' => 422];
                }
                if ($balance + 0.0001 < $amount) {
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
                            ],
                            'status' => 'pending',
                        ]);
                    }

                    $wallet->balance = (float) $wallet->balance - $amount;
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

                $orderType = (string) ($order->type ?? '');

                if ($orderType === 'premium_subscription') {
                    if (empty($orderMeta['premium_activated_at'])) {
                        $level = (string) ($orderMeta['premium_level'] ?? 'bronze');
                        $gameId = (int) ($orderMeta['game_id'] ?? 0);
                        $gameUsername = (string) ($orderMeta['game_username'] ?? '');

                        $levels = [
                            'bronze' => ['duration' => 7],
                            'platine' => ['duration' => 30],
                        ];
                        $duration = (int) ($levels[$level]['duration'] ?? 30);
                        $base = Carbon::now();
                        $currentExpiration = $order->user?->premium_expiration;
                        if ($currentExpiration) {
                            $current = $currentExpiration instanceof Carbon
                                ? $currentExpiration
                                : Carbon::parse((string) $currentExpiration);
                            if ($current->greaterThan($base)) {
                                $base = $current;
                            }
                        }

                        $expiresAt = $base->copy()->addDays(max(1, $duration));

                        // Always activate VIP at user level (membership is optional).
                        $order->user?->update([
                            'is_premium' => true,
                            'premium_level' => $level,
                            'premium_expiration' => $expiresAt,
                        ]);

                        if ($gameId > 0 && $gameUsername !== '') {
                            $membership = PremiumMembership::firstOrNew([
                                'user_id' => $order->user_id,
                                'game_id' => $gameId,
                            ]);

                            $membership->level = $level;
                            $membership->game_username = $gameUsername;
                            $membership->expiration_date = $expiresAt;
                            $membership->is_active = true;
                            $membership->renewal_count = (int) ($membership->renewal_count ?? 0) + 1;
                            $membership->save();
                        }

                        $orderMeta['premium_activated_at'] = now()->toIso8601String();
                    }
                } else {
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
                        if ($order->hasPhysicalItems()) {
                            app(ShippingService::class)->computeShippingForOrder($order);
                            app(SourcingDemandService::class)->syncForPaidOrder($order);
                        }

                        if ($order->requiresRedeemFulfillment()) {
                            ProcessRedeemFulfillment::dispatchSync($order->id);
                        } else {
                            ProcessOrderDelivery::dispatchSync($order);
                        }
                        $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                    }

                    // Marketplace gaming account orders must always create a MarketplaceOrder (seller pending credit + listing sold).
                    if ($orderType === 'marketplace_gaming_account') {
                        // Ensure listing still exists (better error message).
                        $listingId = (int) (
                            $orderMeta['seller_listing_id']
                            ?? ($orderMeta['marketplace']['seller_listing_id'] ?? 0)
                        );

                        $listing = $listingId > 0 ? SellerListing::query()->find($listingId) : null;
                        if ($listingId > 0 && !$listing) {
                            throw new \RuntimeException("Annonce introuvable. Veuillez réessayer.");
                        }

                        // Process marketplace order (idempotent). This makes wallet checkout fully synchronous.
                        ProcessMarketplaceOrder::dispatchSync($order);

                        $ready = MarketplaceOrder::query()->where('order_id', $order->id)->lockForUpdate()->exists();
                        if (!$ready) {
                            $listing = $listingId > 0 ? SellerListing::query()->find($listingId) : null;
                            if ($listing && (int) ($listing->order_id ?? 0) && (int) $listing->order_id !== (int) $order->id) {
                                throw new \RuntimeException("Annonce déjà vendue. Veuillez choisir une autre annonce.");
                            }
                            throw new \RuntimeException("Commande en cours de traitement. Réessaie dans quelques secondes.");
                        }
                    }
                }

                // Preserve any meta updates done by fulfillment jobs (e.g. marketplace order info).
                $freshMeta = $order->fresh()?->meta ?? [];
                if (!is_array($freshMeta)) {
                    $freshMeta = [];
                }
                if (!empty($orderMeta['sales_recorded_at'])) {
                    $freshMeta['sales_recorded_at'] = $freshMeta['sales_recorded_at'] ?? $orderMeta['sales_recorded_at'];
                }
                if (!empty($orderMeta['fulfillment_dispatched_at'])) {
                    $freshMeta['fulfillment_dispatched_at'] = $freshMeta['fulfillment_dispatched_at'] ?? $orderMeta['fulfillment_dispatched_at'];
                }
                $freshMeta['wallet_paid_at'] = $freshMeta['wallet_paid_at'] ?? now()->toIso8601String();
                $order->meta = $freshMeta;
                $order->save();

                return [
                    'ok' => true,
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'wallet_balance' => (float) $wallet->refresh()->balance,
                ];
            });

            if (!($result['ok'] ?? false)) {
                return response()->json(['message' => $result['message'] ?? 'Wallet payment failed'], (int) ($result['status'] ?? 422));
            }

            if (!empty($result['order_id'])) {
                SendOrderPaidSms::dispatch((int) $result['order_id']);
                
                    try {
                        /** @var ReferralCommissionService $referrals */
                        $referrals = app(ReferralCommissionService::class);
                        $referrals->applyForPaidOrderId((int) $result['order_id'], [
                            'source' => 'wallet_pay',
                        ]);
                    } catch (\Throwable $e) {
                        Log::warning('wallet:referral-commission-skip', [
                            'order_id' => (int) $result['order_id'],
                            'message' => $e->getMessage(),
                        ]);
                    }
            }

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            if ($e instanceof \RuntimeException) {
                Log::warning('wallet:pay:runtime', [
                    'stage' => 'wallet-pay',
                    'order_id' => $order->id ?? null,
                    'user_id' => $user->id ?? null,
                    'message' => $e->getMessage(),
                ]);

                return response()->json([
                    'message' => $e->getMessage() ?: 'Paiement wallet en cours de traitement. Réessaie dans quelques secondes.',
                ], 409);
            }

            Log::error('wallet:pay:error', [
                'stage' => 'wallet-pay',
                'order_id' => $order->id ?? null,
                'user_id' => $user->id ?? null,
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Wallet payment failed'], 500);
        }
    }

    public function payWithRewardWallet(Request $request)
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
            return response()->json(['message' => 'Wallet topup cannot be paid with reward wallet'], 422);
        }

        if ((string) $order->status !== Order::STATUS_PAYMENT_PROCESSING) {
            return response()->json(['message' => 'Order is not payable'], 400);
        }

        $amount = (float) ($order->total_price ?? 0);
        if (!is_finite($amount) || $amount <= 0) {
            return response()->json(['message' => 'Invalid order amount'], 422);
        }

        $reference = 'RWPAY-' . ($order->reference ?? $order->id);

        try {
            $result = DB::transaction(function () use ($user, $order, $amount, $reference) {
                /** @var WalletAccount $wallet */
                $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
                if (!$wallet) {
                    return ['ok' => false, 'message' => 'Aucun wallet récompense disponible.', 'status' => 422];
                }

                if ((string) ($wallet->status ?? '') === 'locked') {
                    return ['ok' => false, 'message' => 'Wallet locked', 'status' => 423];
                }

                $minPurchase = (float) ($wallet->reward_min_purchase_amount ?? 0);
                if ($minPurchase > 0) {
                    foreach ($order->orderItems as $item) {
                        $unitPrice = (float) ($item->price ?? 0);
                        if ($unitPrice + 0.0001 < $minPurchase) {
                            return [
                                'ok' => false,
                                'message' => "Votre wallet récompense est limité aux produits à partir de {$minPurchase} FCFA.",
                                'status' => 422,
                            ];
                        }
                    }
                }

                $rewardBalance = (float) ($wallet->reward_balance ?? 0);
                if ($rewardBalance + 0.0001 < $amount) {
                    return ['ok' => false, 'message' => 'Solde wallet récompense insuffisant.', 'status' => 422];
                }

                $existingTx = WalletTransaction::where('reference', $reference)->lockForUpdate()->first();
                if ($existingTx && (string) $existingTx->status === 'success') {
                    // Already paid with reward wallet.
                } else {
                    if (!$existingTx) {
                        $existingTx = WalletTransaction::create([
                            'wallet_account_id' => $wallet->id,
                            'wallet_bucket' => 'reward',
                            'type' => 'debit',
                            'amount' => $amount,
                            'reference' => $reference,
                            'meta' => [
                                'type' => 'tournament_reward_payment',
                                'order_id' => $order->id,
                            ],
                            'status' => 'pending',
                        ]);
                    }

                    $wallet->reward_balance = (float) $wallet->reward_balance - $amount;
                    $wallet->save();

                    $existingTx->status = 'success';
                    $existingTx->save();
                }

                $payment = $order->payment ?? new Payment();
                $payment->fill([
                    'order_id' => $order->id,
                    'wallet_transaction_id' => $existingTx->id,
                    'amount' => $amount,
                    'method' => 'wallet_reward',
                    'status' => 'completed',
                    'transaction_id' => $reference,
                    'webhook_data' => [
                        'source' => 'wallet_reward',
                    ],
                ]);
                $payment->save();

                $order->payment_id = $payment->id;
                $order->status = Order::STATUS_PAYMENT_SUCCESS;

                $orderMeta = $order->meta ?? [];
                if (!is_array($orderMeta)) {
                    $orderMeta = [];
                }

                $orderType = (string) ($order->type ?? '');

                if ($orderType === 'premium_subscription') {
                    if (empty($orderMeta['premium_activated_at'])) {
                        $level = (string) ($orderMeta['premium_level'] ?? 'bronze');
                        $gameId = (int) ($orderMeta['game_id'] ?? 0);
                        $gameUsername = (string) ($orderMeta['game_username'] ?? '');

                        $levels = [
                            'bronze' => ['duration' => 7],
                            'platine' => ['duration' => 30],
                        ];
                        $duration = (int) ($levels[$level]['duration'] ?? 30);
                        $base = Carbon::now();
                        $currentExpiration = $order->user?->premium_expiration;
                        if ($currentExpiration) {
                            $current = $currentExpiration instanceof Carbon
                                ? $currentExpiration
                                : Carbon::parse((string) $currentExpiration);
                            if ($current->greaterThan($base)) {
                                $base = $current;
                            }
                        }

                        $expiresAt = $base->copy()->addDays(max(1, $duration));

                        $order->user?->update([
                            'is_premium' => true,
                            'premium_level' => $level,
                            'premium_expiration' => $expiresAt,
                        ]);

                        if ($gameId > 0 && $gameUsername !== '') {
                            $membership = PremiumMembership::firstOrNew([
                                'user_id' => $order->user_id,
                                'game_id' => $gameId,
                            ]);

                            $membership->level = $level;
                            $membership->game_username = $gameUsername;
                            $membership->expiration_date = $expiresAt;
                            $membership->is_active = true;
                            $membership->renewal_count = (int) ($membership->renewal_count ?? 0) + 1;
                            $membership->save();
                        }

                        $orderMeta['premium_activated_at'] = now()->toIso8601String();
                    }
                } else {
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
                        if ($order->hasPhysicalItems()) {
                            app(ShippingService::class)->computeShippingForOrder($order);
                            app(SourcingDemandService::class)->syncForPaidOrder($order);
                        }

                        if ($order->requiresRedeemFulfillment()) {
                            ProcessRedeemFulfillment::dispatchSync($order->id);
                        } else {
                            ProcessOrderDelivery::dispatchSync($order);
                        }
                        $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                    }

                    if ($orderType === 'marketplace_gaming_account') {
                        $listingId = (int) (
                            $orderMeta['seller_listing_id']
                            ?? ($orderMeta['marketplace']['seller_listing_id'] ?? 0)
                        );

                        $listing = $listingId > 0 ? SellerListing::query()->find($listingId) : null;
                        if ($listingId > 0 && !$listing) {
                            throw new \RuntimeException("Annonce introuvable. Veuillez réessayer.");
                        }

                        ProcessMarketplaceOrder::dispatchSync($order);

                        $ready = MarketplaceOrder::query()->where('order_id', $order->id)->lockForUpdate()->exists();
                        if (!$ready) {
                            $listing = $listingId > 0 ? SellerListing::query()->find($listingId) : null;
                            if ($listing && (int) ($listing->order_id ?? 0) && (int) $listing->order_id !== (int) $order->id) {
                                throw new \RuntimeException("Annonce déjà vendue. Veuillez choisir une autre annonce.");
                            }
                            throw new \RuntimeException("Commande en cours de traitement. Réessaie dans quelques secondes.");
                        }
                    }
                }

                $freshMeta = $order->fresh()?->meta ?? [];
                if (!is_array($freshMeta)) {
                    $freshMeta = [];
                }
                if (!empty($orderMeta['sales_recorded_at'])) {
                    $freshMeta['sales_recorded_at'] = $freshMeta['sales_recorded_at'] ?? $orderMeta['sales_recorded_at'];
                }
                if (!empty($orderMeta['fulfillment_dispatched_at'])) {
                    $freshMeta['fulfillment_dispatched_at'] = $freshMeta['fulfillment_dispatched_at'] ?? $orderMeta['fulfillment_dispatched_at'];
                }
                $freshMeta['reward_wallet_paid_at'] = $freshMeta['reward_wallet_paid_at'] ?? now()->toIso8601String();
                $order->meta = $freshMeta;
                $order->save();

                return [
                    'ok' => true,
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'reward_wallet_balance' => (float) $wallet->refresh()->reward_balance,
                ];
            });

            if (!($result['ok'] ?? false)) {
                return response()->json(['message' => $result['message'] ?? 'Reward wallet payment failed'], (int) ($result['status'] ?? 422));
            }

            if (!empty($result['order_id'])) {
                SendOrderPaidSms::dispatch((int) $result['order_id']);

                try {
                    /** @var ReferralCommissionService $referrals */
                    $referrals = app(ReferralCommissionService::class);
                    $referrals->applyForPaidOrderId((int) $result['order_id'], [
                        'source' => 'wallet_reward_pay',
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('wallet-reward:referral-commission-skip', [
                        'order_id' => (int) $result['order_id'],
                        'message' => $e->getMessage(),
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            if ($e instanceof \RuntimeException) {
                Log::warning('wallet-reward:pay:runtime', [
                    'stage' => 'wallet-reward-pay',
                    'order_id' => $order->id ?? null,
                    'user_id' => $user->id ?? null,
                    'message' => $e->getMessage(),
                ]);

                return response()->json([
                    'message' => $e->getMessage() ?: 'Paiement wallet récompense en cours de traitement. Réessaie dans quelques secondes.',
                ], 409);
            }

            Log::error('wallet-reward:pay:error', [
                'stage' => 'wallet-reward-pay',
                'order_id' => $order->id ?? null,
                'user_id' => $user->id ?? null,
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Reward wallet payment failed'], 500);
        }
    }

    public function exchangeRewardWallet(Request $request)
    {
        $validated = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:1'],
        ]);

        $user = $request->user();

        $result = DB::transaction(function () use ($user, $validated) {
            /** @var WalletAccount|null $wallet */
            $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                return ['ok' => false, 'message' => 'Wallet introuvable.', 'status' => 404];
            }

            $rewardBalance = (float) ($wallet->reward_balance ?? 0);
            if ($rewardBalance <= 0) {
                return ['ok' => false, 'message' => 'Aucun solde récompense à échanger.', 'status' => 422];
            }

            $requested = isset($validated['amount']) ? (float) $validated['amount'] : $rewardBalance;
            $amount = max(0, min($requested, $rewardBalance));
            if ($amount <= 0) {
                return ['ok' => false, 'message' => 'Montant invalide.', 'status' => 422];
            }

            $credited = round($amount * 0.7, 2);

            $exchangeRef = 'RWEX-' . strtoupper(substr((string) \Illuminate\Support\Str::uuid(), 0, 12));

            WalletTransaction::create([
                'wallet_account_id' => $wallet->id,
                'wallet_bucket' => 'reward',
                'type' => 'debit',
                'amount' => $amount,
                'reference' => $exchangeRef . '-D',
                'meta' => [
                    'type' => 'tournament_reward_exchange',
                    'exchange_rate' => 0.7,
                    'credited_main_amount' => $credited,
                ],
                'status' => 'success',
            ]);

            WalletTransaction::create([
                'wallet_account_id' => $wallet->id,
                'wallet_bucket' => 'main',
                'type' => 'credit',
                'amount' => $credited,
                'reference' => $exchangeRef . '-C',
                'meta' => [
                    'type' => 'tournament_reward_exchange',
                    'exchange_rate' => 0.7,
                    'source_reward_amount' => $amount,
                ],
                'status' => 'success',
            ]);

            $wallet->reward_balance = (float) $wallet->reward_balance - $amount;
            $wallet->balance = (float) $wallet->balance + $credited;
            if ((float) $wallet->reward_balance <= 0.0001) {
                $wallet->reward_balance = 0;
                $wallet->reward_min_purchase_amount = null;
            }
            $wallet->save();

            return [
                'ok' => true,
                'exchanged_amount' => $amount,
                'credited_amount' => $credited,
                'reward_balance' => (float) $wallet->reward_balance,
                'main_balance' => (float) $wallet->balance,
            ];
        });

        if (!($result['ok'] ?? false)) {
            return response()->json(['message' => $result['message'] ?? 'Exchange failed'], (int) ($result['status'] ?? 422));
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
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

        // Persist customer's phone on the order so it can be used for SMS after payment.
        $rawPhone = trim((string) ($validated['customer_phone'] ?? ''));
        $digits = preg_replace('/\D+/', '', $rawPhone) ?? '';
        $allZeros = $digits !== '' && preg_match('/^0+$/', $digits);
        if ($digits !== '' && !$allZeros && strlen($digits) >= 6) {
            $orderMeta = $order->meta ?? [];
            if (!is_array($orderMeta)) {
                $orderMeta = [];
            }

            $orderMeta['customer_phone'] = $digits;
            $order->meta = $orderMeta;
            if (empty($order->shipping_phone)) {
                $order->shipping_phone = $digits;
            }
            $order->save();
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

    private function buildFrontendPaymentRedirect(?Order $order, string $status): string
    {
        $frontUrl = rtrim((string) env('FRONTEND_URL', ''), '/');
        $normalizedStatus = strtolower(trim($status));

        if ($order && (string) ($order->type ?? '') === 'wallet_topup') {
            $query = Arr::query(array_filter([
                'wallet_paid' => $normalizedStatus,
                'topup_order' => $order->id,
                'provider' => 'paypal',
            ], static fn ($value) => $value !== null && $value !== ''));

            return ($frontUrl !== '' ? $frontUrl : '') . '/wallet' . ($query !== '' ? ('?' . $query) : '');
        }

        $mappedStatus = match ($normalizedStatus) {
            'paid', 'completed', 'success' => 'paid',
            'cancelled', 'canceled' => 'cancelled',
            'failed' => 'failed',
            default => 'processing',
        };

        $query = Arr::query(array_filter([
            'order' => $order?->id,
            'status' => $mappedStatus,
        ], static fn ($value) => $value !== null && $value !== ''));

        return ($frontUrl !== '' ? $frontUrl : '') . '/order-confirmation' . ($query !== '' ? ('?' . $query) : '');
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

            $normalizedRedeemSku = mb_strtolower(trim((string) ($product->redeem_sku ?? '')));
            $productHasActiveRedeemDenominations = RedeemDenomination::query()
                ->where('active', true)
                ->where(function ($q) use ($product, $normalizedRedeemSku) {
                    $q->where('product_id', $product->id);
                    if ($normalizedRedeemSku !== '') {
                        $q->orWhereRaw('LOWER(code) = ?', [$normalizedRedeemSku]);
                    }
                })
                ->exists();

            $requiresDenomination = ($product->stock_mode ?? 'manual') === 'redeem_pool'
                || (bool) ($product->redeem_code_delivery ?? false)
                || $normalizedRedeemSku !== ''
                || strtolower((string) ($product->type ?? '')) === 'redeem'
                || $productHasActiveRedeemDenominations;

            if (!$requiresDenomination) {
                continue;
            }

            $quantity = max(1, (int) ($orderItem->quantity ?? 1));

            // Prefer product-scoped denominations first to keep codes tied to the product.
            $denominations = RedeemDenomination::query()
                ->where('active', true)
                ->when($normalizedRedeemSku !== '', function ($q) use ($normalizedRedeemSku) {
                    $q->whereRaw('LOWER(code) = ?', [$normalizedRedeemSku]);
                }, function ($q) use ($product) {
                    $q->where('product_id', $product->id);
                })
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
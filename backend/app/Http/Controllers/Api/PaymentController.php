<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\PremiumMembership;
use App\Services\CinetPayService;
use App\Services\FedaPayService;
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

        if ($order->status !== 'pending') {
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

            $initResult = $this->fedaPayService->initPayment($order, $user, [
                'amount' => $expectedAmount,
                'currency' => $currency,
                'description' => $validated['description'] ?? null,
                'customer_name' => $validated['customer_name'] ?? null,
                'customer_phone' => $resolvedPhone,
                'customer_email' => $resolvedEmail,
                'callback_url' => $validated['callback_url'] ?? null,
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

        $status = $payment->status;

        if (!in_array($payment->status, ['completed', 'failed'], true) && $payment->transaction_id) {
            try {
                $verification = $this->fedaPayService->retrieveTransaction($payment->transaction_id);
                $normalized = $this->fedaPayService->normalizeStatus($verification);
                $amountFromProvider = (float) (
                    Arr::get($verification, 'amount')
                        ?? Arr::get($verification, 'data.amount')
                        ?? Arr::get($verification, 'transaction.amount')
                        ?? Arr::get($verification, 'data.transaction.amount')
                        ?? 0
                );

                if ($normalized !== 'pending') {
                    DB::transaction(function () use ($payment, $normalized, $verification, $amountFromProvider) {
                        $previousOrderStatus = $payment->order?->status;
                        $meta = $payment->webhook_data ?? [];
                        if (!is_array($meta)) {
                            $meta = [];
                        }
                        $meta['verification'] = $verification;

                        $payment->update([
                            'status' => $normalized,
                            'webhook_data' => $meta,
                        ]);

                        if ($payment->order) {
                            $payment->order->update([
                                'status' => $normalized === 'completed'
                                    ? 'paid'
                                    : ($normalized === 'failed' ? 'failed' : $payment->order->status),
                            ]);

                            if ((string) ($payment->order->type ?? '') === 'wallet_topup') {
                                $order = $payment->order->fresh(['user']);
                                $reference = (string) ($payment->walletTransaction?->reference ?? $order->reference ?? '');

                                if ($normalized === 'completed' && $order?->user && $reference !== '') {
                                    if ($amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) > 0.01) {
                                        Log::error('fedapay:error', [
                                            'stage' => 'topup-status-amount',
                                            'payment_id' => $payment->id,
                                            'expected' => (float) $payment->amount,
                                            'received' => $amountFromProvider,
                                        ]);
                                    } else {
                                        app(WalletService::class)->credit($order->user, $reference, (float) $payment->amount, [
                                            'source' => 'fedapay_topup_status',
                                            'payment_id' => $payment->id,
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

                            if ($normalized === 'completed' && (string) ($payment->order->type ?? '') === 'premium_subscription') {
                                $order = $payment->order->fresh(['user']);
                                $orderMeta = $order->meta ?? [];
                                if (!is_array($orderMeta)) {
                                    $orderMeta = [];
                                }

                                if (empty($orderMeta['premium_activated_at'])) {
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

                                        $order->user?->update([
                                            'is_premium' => true,
                                            'premium_level' => $level,
                                            'premium_expiration' => $membership->expiration_date,
                                        ]);

                                        $orderMeta['premium_activated_at'] = now()->toIso8601String();
                                        $order->update(['meta' => $orderMeta]);
                                    }
                                }
                            }

                            if ($normalized === 'completed'
                                && $payment->order->type !== 'wallet_topup'
                                && $previousOrderStatus !== 'paid') {
                                $payment->order->loadMissing('orderItems.product');

                                $orderMeta = $payment->order->meta ?? [];
                                if (!is_array($orderMeta)) {
                                    $orderMeta = [];
                                }

                                if (empty($orderMeta['sales_recorded_at'])) {
                                    foreach ($payment->order->orderItems as $item) {
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
                                    if ($payment->order->requiresRedeemFulfillment()) {
                                        ProcessRedeemFulfillment::dispatch($payment->order->id);
                                    } else {
                                        ProcessOrderDelivery::dispatch($payment->order);
                                    }
                                    $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                                }

                                $payment->order->update(['meta' => $orderMeta]);
                            }
                        }
                    });

                    $status = $normalized;
                }
            } catch (\Throwable $e) {
                Log::warning('fedapay:error', [
                    'stage' => 'status-check',
                    'payment_id' => $payment->id,
                    'message' => $e->getMessage(),
                ]);
            }
        }

        if ($payment->status === 'completed' && $payment->order && $payment->order->type !== 'wallet_topup') {
            $payment->order->loadMissing('orderItems.product');

            if (!in_array($payment->order->status, ['paid', 'fulfilled', 'paid_but_out_of_stock'], true)) {
                $payment->order->update(['status' => 'paid']);
            }

            $orderMeta = $payment->order->meta ?? [];
            if (!is_array($orderMeta)) {
                $orderMeta = [];
            }

            if (empty($orderMeta['sales_recorded_at'])) {
                foreach ($payment->order->orderItems as $item) {
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
                if ($payment->order->requiresRedeemFulfillment()) {
                    ProcessRedeemFulfillment::dispatch($payment->order->id);
                } else {
                    ProcessOrderDelivery::dispatch($payment->order);
                }
                $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
            }

            $payment->order->update(['meta' => $orderMeta]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'payment_status' => $status === 'completed' ? 'paid' : $status,
                'order_status' => $payment->order->status,
                'order_type' => $payment->order->type,
                'transaction_id' => $payment->transaction_id,
                'order_id' => $payment->order_id,
            ],
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

        if ($order->status !== 'pending') {
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

        $status = $payment->status;

        if (!in_array($payment->status, ['completed', 'failed'], true) && $payment->transaction_id) {
            try {
                $verification = $this->cinetPayService->verifyTransaction($payment->transaction_id);
                $normalized = $this->cinetPayService->normalizeStatus($verification);
                $amountFromProvider = (float) Arr::get($verification, 'data.amount', 0);

                if ($normalized !== 'pending') {
                    DB::transaction(function () use ($payment, $normalized, $verification, $amountFromProvider) {
                            $previousOrderStatus = $payment->order?->status;
                        $meta = $payment->webhook_data ?? [];
                        if (!is_array($meta)) {
                            $meta = [];
                        }
                        $meta['verification'] = $verification;

                        $payment->update([
                            'status' => $normalized,
                            'webhook_data' => $meta,
                        ]);

                        if ($payment->order) {
                            $payment->order->update([
                                'status' => $normalized === 'completed'
                                    ? 'paid'
                                    : ($normalized === 'failed' ? 'failed' : $payment->order->status),
                            ]);

                            // Wallet topups must credit the wallet. Webhook can fail in production,
                            // so we also credit on status polling in an idempotent way.
                            if ((string) ($payment->order->type ?? '') === 'wallet_topup') {
                                $order = $payment->order->fresh(['user']);
                                $reference = (string) ($payment->walletTransaction?->reference ?? $order->reference ?? '');

                                if ($normalized === 'completed' && $order?->user && $reference !== '') {
                                    if ($amountFromProvider > 0 && abs((float) $payment->amount - $amountFromProvider) > 0.01) {
                                        Log::error('cinetpay:error', [
                                            'stage' => 'topup-status-amount',
                                            'payment_id' => $payment->id,
                                            'expected' => (float) $payment->amount,
                                            'received' => $amountFromProvider,
                                        ]);
                                    } else {
                                        app(WalletService::class)->credit($order->user, $reference, (float) $payment->amount, [
                                            'source' => 'cinetpay_topup_status',
                                            'payment_id' => $payment->id,
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

                            if ($normalized === 'completed' && (string) ($payment->order->type ?? '') === 'premium_subscription') {
                                $order = $payment->order->fresh(['user']);
                                $orderMeta = $order->meta ?? [];
                                if (!is_array($orderMeta)) {
                                    $orderMeta = [];
                                }

                                if (empty($orderMeta['premium_activated_at'])) {
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

                                        $order->user?->update([
                                            'is_premium' => true,
                                            'premium_level' => $level,
                                            'premium_expiration' => $membership->expiration_date,
                                        ]);

                                        $orderMeta['premium_activated_at'] = now()->toIso8601String();
                                        $order->update(['meta' => $orderMeta]);
                                    }
                                }
                            }

                                if ($normalized === 'completed'
                                    && $payment->order->type !== 'wallet_topup'
                                    && $previousOrderStatus !== 'paid') {
                                    $payment->order->loadMissing('orderItems.product');

                                    $orderMeta = $payment->order->meta ?? [];
                                    if (!is_array($orderMeta)) {
                                        $orderMeta = [];
                                    }

                                    if (empty($orderMeta['sales_recorded_at'])) {
                                        foreach ($payment->order->orderItems as $item) {
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
                                        if ($payment->order->requiresRedeemFulfillment()) {
                                            ProcessRedeemFulfillment::dispatch($payment->order->id);
                                        } else {
                                            ProcessOrderDelivery::dispatch($payment->order);
                                        }
                                        $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                                    }

                                    $payment->order->update(['meta' => $orderMeta]);
                                }
                        }
                    });

                    $status = $normalized;
                }
            } catch (\Throwable $e) {
                Log::warning('cinetpay:error', [
                    'stage' => 'status-check',
                    'payment_id' => $payment->id,
                    'message' => $e->getMessage(),
                ]);
            }
        }

        // If the webhook already marked the payment as completed, ensure the order status
        // and fulfillment dispatch are not left behind.
        if ($payment->status === 'completed' && $payment->order && $payment->order->type !== 'wallet_topup') {
            $payment->order->loadMissing('orderItems.product');

            if (!in_array($payment->order->status, ['paid', 'fulfilled', 'paid_but_out_of_stock'], true)) {
                $payment->order->update(['status' => 'paid']);
            }

            $orderMeta = $payment->order->meta ?? [];
            if (!is_array($orderMeta)) {
                $orderMeta = [];
            }

            if (empty($orderMeta['sales_recorded_at'])) {
                foreach ($payment->order->orderItems as $item) {
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
                if ($payment->order->requiresRedeemFulfillment()) {
                    ProcessRedeemFulfillment::dispatch($payment->order->id);
                } else {
                    ProcessOrderDelivery::dispatch($payment->order);
                }
                $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
            }

            $payment->order->update(['meta' => $orderMeta]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'payment_status' => $status === 'completed' ? 'paid' : $status,
                'order_status' => $payment->order->status,
                'order_type' => $payment->order->type,
                'transaction_id' => $payment->transaction_id,
                'order_id' => $payment->order_id,
            ],
        ]);
    }
}
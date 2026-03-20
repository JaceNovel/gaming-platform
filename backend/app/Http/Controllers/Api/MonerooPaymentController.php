<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Services\MonerooService;
use App\Services\PaymentSettlementService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class MonerooPaymentController extends Controller
{
    public function __construct(
        private MonerooService $monerooService,
        private PaymentSettlementService $paymentSettlementService,
    ) {
    }

    public function init(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', Rule::exists('orders', 'id')],
            'payment_method' => ['nullable', Rule::in(['moneroo'])],
            'amount' => ['required', 'numeric', 'min:100'],
            'currency' => ['required', 'string', 'size:3'],
            'customer_email' => ['nullable', 'email'],
            'customer_name' => ['nullable', 'string', 'max:191'],
            'customer_phone' => ['nullable', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:191'],
            'callback_url' => ['nullable', 'url', 'max:2048'],
            'metadata' => ['sometimes', 'array'],
            'methods' => ['sometimes', 'array'],
            'methods.*' => ['string', 'max:64'],
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
        if ($currency !== strtoupper((string) config('moneroo.default_currency', 'XOF'))) {
            return response()->json(['message' => 'Unsupported currency'], 422);
        }

        try {
            $payment = DB::transaction(function () use ($order, $expectedAmount) {
                $payment = $order->payment ?? new Payment();

                $payment->fill([
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'method' => 'moneroo',
                    'status' => 'pending',
                ]);
                $payment->save();

                $order->payment_id = $payment->id;
                $order->save();

                return $payment->fresh(['order']);
            });

            $appUrl = rtrim((string) config('app.url', env('APP_URL', '')), '/');
            $callbackUrl = trim((string) ($validated['callback_url'] ?? ''));
            if ($callbackUrl === '' && $appUrl !== '') {
                $callbackUrl = $appUrl . '/api/payments/moneroo/return?' . Arr::query([
                    'order_id' => $order->id,
                    'provider' => 'moneroo',
                ]);
            }

            $initResult = $this->monerooService->initPayment($order, $user, [
                'amount' => $expectedAmount,
                'currency' => $currency,
                'description' => $validated['description'] ?? null,
                'customer_email' => $validated['customer_email'] ?? $user->email,
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_first_name' => $validated['customer_name'] ?? null,
                'return_url' => $callbackUrl,
                'methods' => $validated['methods'] ?? [],
                'metadata' => array_merge($validated['metadata'] ?? [], [
                    'source' => 'checkout',
                    'order_id' => (string) $order->id,
                    'user_id' => (string) $user->id,
                ]),
            ]);

            $meta = $payment->webhook_data ?? [];
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['init_response'] = $initResult['raw'] ?? null;

            $payment->update([
                'status' => 'pending',
                'transaction_id' => (string) $initResult['transaction_id'],
                'webhook_data' => $meta,
            ]);

            PaymentAttempt::updateOrCreate(
                ['transaction_id' => (string) $initResult['transaction_id']],
                [
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'currency' => $currency,
                    'status' => 'pending',
                    'provider' => 'moneroo',
                    'raw_payload' => [
                        'init_response' => $initResult['raw'] ?? null,
                    ],
                ]
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'payment_url' => $initResult['payment_url'],
                    'transaction_id' => (string) $initResult['transaction_id'],
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'amount' => $expectedAmount,
                    'currency' => $currency,
                    'status' => 'pending',
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('moneroo:init-error', [
                'order_id' => $validated['order_id'] ?? null,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => config('app.debug') ? ('Payment initiation failed: ' . $e->getMessage()) : 'Payment initiation failed',
            ], 502);
        }
    }

    public function redirectReturn(Request $request)
    {
        $orderId = (int) ($request->query('order_id') ?? $request->input('order_id') ?? 0);
        $transactionId = trim((string) (
            $request->query('paymentId')
            ?? $request->query('transaction_id')
            ?? $request->input('paymentId')
            ?? $request->input('transaction_id')
            ?? ''
        ));

        $order = $orderId > 0
            ? Order::with(['payment.walletTransaction', 'user'])->find($orderId)
            : null;

        $frontUrl = rtrim((string) env('FRONTEND_URL', ''), '/');
        $isWalletTopup = (string) ($order?->type ?? '') === 'wallet_topup';
        $walletPaid = null;

        if ($order && $order->payment && strtolower((string) ($order->payment->method ?? '')) === 'moneroo') {
            try {
                $status = $this->syncPayment($order->payment, 'return_endpoint', $transactionId);
                $order->refresh();
                $order->load(['payment.walletTransaction', 'user']);

                if ($isWalletTopup && $status === 'completed') {
                    $this->paymentSettlementService->ensureWalletTopupCredited($order->payment, [
                        'source' => 'moneroo_return',
                    ]);
                    $order->refresh();
                    $order->load(['payment.walletTransaction', 'user']);
                }
            } catch (\Throwable $e) {
                Log::warning('moneroo:return-sync-failed', [
                    'order_id' => $order->id,
                    'transaction_id' => $transactionId !== '' ? $transactionId : null,
                    'message' => $e->getMessage(),
                ]);
            }

            if ($order->isPaymentSuccess()) {
                $walletPaid = 'paid';
            } elseif ($order->isPaymentFailed()) {
                $walletPaid = 'failed';
            } else {
                $walletPaid = 'processing';
            }
        }

        $fallbackRedirect = $frontUrl !== ''
            ? ($isWalletTopup
                ? $frontUrl . '/wallet' . ($orderId > 0 ? ('?topup_order=' . $orderId) : '')
                : $frontUrl . '/order-confirmation' . ($orderId > 0 ? ('?order=' . $orderId) : ''))
            : '/';

        if ($frontUrl === '') {
            return redirect()->away($fallbackRedirect);
        }

        if ($isWalletTopup) {
            $params = array_filter([
                $orderId > 0 ? 'topup_order=' . $orderId : null,
                'provider=moneroo',
                $walletPaid ? 'wallet_paid=' . $walletPaid : null,
            ]);

            return redirect()->away($frontUrl . '/wallet' . ($params !== [] ? ('?' . implode('&', $params)) : ''));
        }

        return redirect()->away($frontUrl . '/order-confirmation' . ($orderId > 0 ? ('?order=' . $orderId) : ''));
    }

    public function status(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id'), 'required_without:transaction_id'],
            'transaction_id' => ['nullable', 'string', 'max:191', 'required_without:order_id'],
        ]);

        $user = $request->user();
        $baseQuery = Payment::with(['order.user', 'walletTransaction'])
            ->where('method', 'moneroo')
            ->whereHas('order', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            });

        $payment = null;
        if (!empty($validated['transaction_id'])) {
            $payment = (clone $baseQuery)->where('transaction_id', $validated['transaction_id'])->latest('id')->first();
        }
        if (!$payment && !empty($validated['order_id'])) {
            $payment = (clone $baseQuery)->where('order_id', $validated['order_id'])->latest('id')->first();
        }

        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        $order = $payment->order;
        if (!$order) {
            return response()->json(['message' => 'Order not found for payment'], 404);
        }

        try {
            if (!$order->isPaymentSuccess() && !$order->isPaymentFailed() && $payment->transaction_id) {
                $this->syncPayment($payment, 'status_endpoint');
                $payment = $payment->fresh(['order.user', 'walletTransaction']);
                $order = $payment?->order;
            }

            if ($payment && $order && (string) ($order->type ?? '') === 'wallet_topup' && (string) ($payment->status ?? '') === 'completed') {
                $this->paymentSettlementService->ensureWalletTopupCredited($payment, [
                    'source' => 'moneroo_status',
                ]);

                $payment = $payment->fresh(['order.user', 'walletTransaction']);
                $order = $payment?->order;
            }
        } catch (\Throwable $e) {
            Log::warning('moneroo:status-sync-failed', [
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

    public function syncPayment(Payment $payment, string $source, ?string $transactionId = null): string
    {
        $providerId = trim((string) ($transactionId ?: $payment->transaction_id ?: ''));
        if ($providerId === '') {
            throw new \RuntimeException('Missing Moneroo transaction id.');
        }

        $providerPayload = $this->monerooService->verifyPayment($providerId);
        $normalized = $this->monerooService->normalizePaymentStatus($providerPayload);

        $this->paymentSettlementService->settle($payment, $normalized, [
            'provider' => 'moneroo',
            'attempt_currency' => $this->monerooService->extractCurrencyCode($providerPayload),
            'provider_transaction_id' => $providerId,
            'provider_payload' => $providerPayload,
            'source' => $source,
        ]);

        return $normalized;
    }
}
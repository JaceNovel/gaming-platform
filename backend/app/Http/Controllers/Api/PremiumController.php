<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PremiumMembership;
use App\Models\WalletBd;
use App\Services\FedaPayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Support\Str;

class PremiumController extends Controller
{
    public function __construct(private FedaPayService $fedaPayService)
    {
    }

    public function status(Request $request)
    {
        $user = $request->user();
        $membership = $user->premiumMemberships()->latest()->first();

        return response()->json([
            'is_premium' => $user->is_premium,
            'level' => $user->premium_level,
            'expiration' => $user->premium_expiration,
            'membership' => $membership,
            'renewal_count' => $membership ? $membership->renewal_count : 0,
        ]);
    }

    /**
    * Initiate a Premium (VIP) subscription payment via FedaPay.
     * This is intentionally NOT a cart product.
     */
    public function init(Request $request)
    {
        $validated = $request->validate([
            'level' => 'required|in:bronze,platine',
            'game_id' => 'required|exists:games,id',
            'game_username' => 'required|string|max:255',
        ]);

        $user = $request->user();
        $email = trim((string) ($user->email ?? ''));
        if ($email === '') {
            return response()->json([
                'message' => 'Email requis pour effectuer le paiement.',
            ], 422);
        }

        $levels = [
            'bronze' => ['price' => 10000, 'duration' => 30],
            'platine' => ['price' => 13000, 'duration' => 30],
        ];

        $price = (float) $levels[$validated['level']]['price'];

        [$order, $payment] = DB::transaction(function () use ($user, $validated, $price) {
            $order = Order::create([
                'user_id' => $user->id,
                'type' => 'premium_subscription',
                'status' => Order::STATUS_PAYMENT_PROCESSING,
                'total_price' => $price,
                'items' => null,
                'meta' => [
                    'premium_level' => $validated['level'],
                    'game_id' => (int) $validated['game_id'],
                    'game_username' => $validated['game_username'],
                ],
                'reference' => 'VIP-' . strtoupper(uniqid()),
            ]);

            $payment = Payment::create([
                'order_id' => $order->id,
                'amount' => $price,
                'method' => 'fedapay',
                'status' => 'pending',
            ]);

            $order->update(['payment_id' => $payment->id]);

            return [$order->fresh(['user', 'payment']), $payment->fresh()];
        });

        $frontUrl = rtrim((string) env('FRONTEND_URL', ''), '/');
        $callbackUrl = $frontUrl !== ''
            ? $frontUrl . '/checkout/status?provider=fedapay&order_id=' . $order->id
            : null;

        $initResult = $this->fedaPayService->initPayment($order, $user, [
            'amount' => $price,
            'currency' => strtoupper(config('fedapay.default_currency', 'XOF')),
            'description' => sprintf('BADBOY VIP (%s)', strtoupper((string) $validated['level'])),
            'callback_url' => $callbackUrl,
            'customer_email' => $email,
            'metadata' => [
                'order_id' => $order->id,
                'type' => 'premium_subscription',
                'premium_level' => $validated['level'],
                'game_id' => (int) $validated['game_id'],
                'game_username' => $validated['game_username'],
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

        PaymentAttempt::updateOrCreate(
            ['transaction_id' => $transactionId],
            [
                'order_id' => $order->id,
                'amount' => $price,
                'currency' => strtoupper(config('fedapay.default_currency', 'XOF')),
                'status' => 'pending',
                'provider' => 'fedapay',
                'raw_payload' => [
                    'init_request' => [
                        'order_id' => $order->id,
                        'amount' => $price,
                    ],
                    'init_response' => $initResult['raw'] ?? null,
                ],
            ]
        );

        return response()->json([
            'payment_url' => $initResult['payment_url'],
            'transaction_id' => $initResult['transaction_id'],
            'order_id' => $order->id,
            'amount' => $price,
            'currency' => strtoupper(config('fedapay.default_currency', 'XOF')),
        ]);
    }

    /**
     * Create a Premium (VIP) subscription order intended to be paid with DBWallet.
     * Frontend should then call POST /payments/wallet/pay with the returned order_id.
     */
    public function initWallet(Request $request)
    {
        $validated = $request->validate([
            'level' => 'required|in:bronze,platine',
            'game_id' => 'required|exists:games,id',
            'game_username' => 'required|string|max:255',
        ]);

        $user = $request->user();

        $levels = [
            'bronze' => ['price' => 10000, 'duration' => 30],
            'platine' => ['price' => 13000, 'duration' => 30],
        ];

        $price = (float) $levels[$validated['level']]['price'];

        $order = DB::transaction(function () use ($user, $validated, $price) {
            return Order::create([
                'user_id' => $user->id,
                'type' => 'premium_subscription',
                'status' => Order::STATUS_PAYMENT_PROCESSING,
                'total_price' => $price,
                'items' => null,
                'meta' => [
                    'premium_level' => $validated['level'],
                    'game_id' => (int) $validated['game_id'],
                    'game_username' => $validated['game_username'],
                    'payment_intent' => 'wallet',
                ],
                'reference' => 'VIPW-' . strtoupper(uniqid()),
            ]);
        });

        return response()->json([
            'order_id' => $order->id,
            'amount' => $price,
            'currency' => 'XOF',
        ]);
    }

    public function subscribe(Request $request)
    {
        // STRICT: premium activation is webhook-driven. This endpoint is a safe DB-only check.
        $validated = $request->validate([
            'order_id' => 'required|integer|exists:orders,id',
        ]);

        $user = $request->user();

        $order = Order::with('user')
            ->where('id', (int) $validated['order_id'])
            ->where('user_id', $user->id)
            ->where('type', 'premium_subscription')
            ->firstOrFail();

        return response()->json([
            'payment_status' => $order->isPaymentSuccess() ? 'paid' : ($order->isPaymentFailed() ? 'failed' : 'processing'),
            'order_status' => $order->status,
            'is_premium' => (bool) $user->is_premium,
            'premium_level' => $user->premium_level,
            'premium_expiration' => $user->premium_expiration,
        ]);
    }

    public function wallet(Request $request)
    {
        $user = $request->user();
        $wallet = $user->walletBd ?? WalletBd::create(['user_id' => $user->id, 'balance' => 0]);

        return response()->json([
            'balance' => $wallet->balance,
        ]);
    }

    public function cancel(Request $request)
    {
        $user = $request->user();
        $membership = $user->premiumMemberships()->where('is_active', true)->latest()->first();

        if (!$membership) {
            return response()->json([
                'message' => 'Aucun abonnement actif à résilier',
            ], 400);
        }

        DB::transaction(function () use ($membership, $user) {
            $membership->update([
                'is_active' => false,
                'expiration_date' => Carbon::now(),
            ]);

            $user->update([
                'is_premium' => false,
                'premium_level' => null,
                'premium_expiration' => null,
            ]);
        });

        return response()->json([
            'message' => "Abonnement résilié. Aucun remboursement ne sera effectué.",
        ]);
    }
}

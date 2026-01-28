<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PremiumMembership;
use App\Models\Referral;
use App\Models\WalletBd;
use App\Services\CinetPayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PremiumController extends Controller
{
    public function __construct(private CinetPayService $cinetPayService)
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
     * Initiate a Premium (VIP) subscription payment via CinetPay.
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

        $levels = [
            'bronze' => ['price' => 10000, 'duration' => 30],
            'platine' => ['price' => 13000, 'duration' => 30],
        ];

        $price = (float) $levels[$validated['level']]['price'];

        [$order, $payment] = DB::transaction(function () use ($user, $validated, $price) {
            $order = Order::create([
                'user_id' => $user->id,
                'type' => 'premium_subscription',
                'status' => 'pending',
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
                'method' => 'cinetpay',
                'status' => 'pending',
            ]);

            $order->update(['payment_id' => $payment->id]);

            return [$order->fresh(['user', 'payment']), $payment->fresh()];
        });

        $transactionId = $payment->transaction_id ?? $this->cinetPayService->generateTransactionId($order);
        $payment->update(['transaction_id' => $transactionId]);

        $initResult = $this->cinetPayService->initPayment($order, $user, [
            'transaction_id' => $transactionId,
            'amount' => $price,
            'description' => sprintf('BADBOY VIP (%s)', strtoupper((string) $validated['level'])),
            'metadata' => [
                'order_id' => $order->id,
                'type' => 'premium_subscription',
                'premium_level' => $validated['level'],
                'game_id' => (int) $validated['game_id'],
                'game_username' => $validated['game_username'],
                'user_id' => $user->id,
            ],
            // Return URL uses the standard redirect endpoint so frontend lands on /checkout/status
            'return_url' => route('api.payments.cinetpay.return', [
                'order_id' => $order->id,
                'transaction_id' => $transactionId,
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

        return response()->json([
            'payment_url' => $initResult['payment_url'],
            'transaction_id' => $initResult['transaction_id'],
            'order_id' => $order->id,
            'amount' => $price,
            'currency' => strtoupper(config('cinetpay.default_currency', 'XOF')),
        ]);
    }

    public function subscribe(Request $request)
    {
        $request->validate([
            'level' => 'required|in:bronze,platine',
            'game_id' => 'required|exists:games,id',
            'game_username' => 'required|string|max:255',
        ]);

        $user = $request->user();

        // Check if game_username is already used for premium
        $existing = PremiumMembership::where('game_id', $request->game_id)
            ->where('game_username', $request->game_username)
            ->where('is_active', true)
            ->first();

        if ($existing && $existing->user_id !== $user->id) {
            return response()->json(['message' => 'This game username is already used for premium membership'], 400);
        }

        DB::transaction(function () use ($request, $user) {
            $levels = [
                'bronze' => ['price' => 10000, 'duration' => 30],
                'platine' => ['price' => 13000, 'duration' => 30],
            ];

            $level = $levels[$request->level];

            // Create or update membership
            $membership = PremiumMembership::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'game_id' => $request->game_id,
                ],
                [
                    'level' => $request->level,
                    'game_username' => $request->game_username,
                    'expiration_date' => Carbon::now()->addDays($level['duration']),
                    'is_active' => true,
                    'renewal_count' => DB::raw('renewal_count + 1'),
                ]
            );

            // Update user
            $user->update([
                'is_premium' => true,
                'premium_level' => $request->level,
                'premium_expiration' => $membership->expiration_date,
            ]);
        });

        return response()->json(['message' => 'Premium subscription successful']);
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

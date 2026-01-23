<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PremiumMembership;
use App\Models\Referral;
use App\Models\WalletBd;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PremiumController extends Controller
{
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

    public function subscribe(Request $request)
    {
        $request->validate([
            'level' => 'required|in:bronze,or,platine',
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
                'bronze' => ['price' => 6000, 'duration' => 30],
                'or' => ['price' => 10000, 'duration' => 30],
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
}

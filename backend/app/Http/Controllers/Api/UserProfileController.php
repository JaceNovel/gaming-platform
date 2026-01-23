<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WalletService;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    public function __construct(private WalletService $walletService)
    {
    }

    public function show(Request $request)
    {
        $user = $request->user();
        $wallet = $this->walletService->getOrCreateWallet($user);

        return response()->json([
            'me' => [
                'username' => $user->game_username ?: $user->name,
                'countryCode' => $user->country_code,
                'countryName' => $user->country_name,
                'avatarId' => $user->avatar_id ?? 'shadow_default',
                'walletBalanceFcfa' => (float) $wallet->balance,
                'premiumTier' => $user->premium_tier ?: $this->inferPremiumTier($user),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'countryCode' => 'sometimes|required|string|size:2',
            'countryName' => 'sometimes|required|string|max:100',
            'avatarId' => 'sometimes|required|string|max:64',
        ]);

        $user = $request->user();

        if (array_key_exists('countryCode', $data)) {
            $user->country_code = strtoupper($data['countryCode']);
        }
        if (array_key_exists('countryName', $data)) {
            $user->country_name = $data['countryName'];
        }
        if (array_key_exists('avatarId', $data)) {
            $user->avatar_id = $data['avatarId'];
        }

        $user->save();

        $wallet = $this->walletService->getOrCreateWallet($user);

        return response()->json([
            'me' => [
                'username' => $user->game_username ?: $user->name,
                'countryCode' => $user->country_code,
                'countryName' => $user->country_name,
                'avatarId' => $user->avatar_id ?? 'shadow_default',
                'walletBalanceFcfa' => (float) $wallet->balance,
                'premiumTier' => $user->premium_tier ?: $this->inferPremiumTier($user),
            ],
        ]);
    }

    private function inferPremiumTier($user): string
    {
        if (!$user->is_premium) {
            return 'Bronze';
        }

        return match ((int) ($user->premium_level ?? 1)) {
            3 => 'Platine',
            2 => 'Or',
            default => 'Bronze',
        };
    }
}

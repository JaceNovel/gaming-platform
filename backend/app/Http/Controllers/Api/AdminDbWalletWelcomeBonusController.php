<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\AdminAuditLogger;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminDbWalletWelcomeBonusController extends Controller
{
    public function index(Request $request, WalletService $walletService)
    {
        // First 20 users by created_at.
        $users = User::query()
            ->orderBy('created_at', 'asc')
            ->limit(20)
            ->get();

        $rows = $users->map(function (User $user) use ($walletService) {
            $wallet = $walletService->getOrCreateWallet($user)->fresh();

            $alreadyGranted = WalletTransaction::query()
                ->where('wallet_account_id', $wallet->id)
                ->where('meta->type', 'welcome_bonus')
                ->exists();

            $expiresAt = $wallet->bonus_expires_at;
            $bonusActive = (float) ($wallet->bonus_balance ?? 0) > 0
                && $expiresAt
                && $expiresAt->isFuture();

            return [
                'user_id' => $user->id,
                'email' => $user->email,
                'created_at' => optional($user->created_at)->toIso8601String(),
                'wallet_id' => $wallet->wallet_id,
                'bonus_balance' => (float) ($wallet->bonus_balance ?? 0),
                'bonus_expires_at' => optional($wallet->bonus_expires_at)->toIso8601String(),
                'bonus_active' => $bonusActive,
                'already_granted' => $alreadyGranted,
            ];
        })->values();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function grant(Request $request)
    {
        $validated = $request->validate([
            'wallet_id' => ['required', 'string', 'max:64'],
            'amount' => ['required', 'numeric', 'min:1'],
        ]);

        $walletId = trim((string) $validated['wallet_id']);
        $amount = (float) $validated['amount'];

        $wallet = WalletAccount::with('user')->where('wallet_id', $walletId)->first();
        if (!$wallet || !$wallet->user) {
            return response()->json(['message' => 'Wallet introuvable'], 404);
        }

        // Eligibility: user must be within first 20 registrations.
        $eligibleIds = User::query()->orderBy('created_at', 'asc')->limit(20)->pluck('id');
        if (!$eligibleIds->contains($wallet->user_id)) {
            return response()->json(['message' => "Utilisateur non éligible (hors des 20 premiers)."], 422);
        }

        $alreadyGranted = WalletTransaction::query()
            ->where('wallet_account_id', $wallet->id)
            ->where('meta->type', 'welcome_bonus')
            ->exists();

        if ($alreadyGranted) {
            return response()->json(['message' => 'Welcome bonus déjà attribué.'], 409);
        }

        $expiresAt = now()->addHours(24);
        $reference = 'WBONUS-' . strtoupper(Str::random(10));

        // Apply bonus balance (not normal balance)
        $wallet->bonus_balance = (float) ($wallet->bonus_balance ?? 0) + $amount;
        $wallet->bonus_expires_at = $expiresAt;
        $wallet->save();

        WalletTransaction::create([
            'wallet_account_id' => $wallet->id,
            'type' => 'credit',
            'amount' => $amount,
            'reference' => $reference,
            'meta' => [
                'type' => 'welcome_bonus',
                'admin_id' => $request->user()?->id,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
            'status' => 'success',
        ]);

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log(
                $request->user(),
                'dbwallet_welcome_bonus_grant',
                [
                    'wallet_id' => $wallet->wallet_id,
                    'user_id' => $wallet->user_id,
                    'amount' => $amount,
                    'reference' => $reference,
                    'expires_at' => $expiresAt->toIso8601String(),
                ],
                actionType: 'dbwallet',
                request: $request
            );
        } catch (\Throwable $e) {
            // ignore
        }

        return response()->json([
            'success' => true,
            'data' => [
                'wallet_id' => $wallet->wallet_id,
                'user_id' => $wallet->user_id,
                'amount' => $amount,
                'bonus_balance' => (float) $wallet->bonus_balance,
                'bonus_expires_at' => $expiresAt->toIso8601String(),
                'reference' => $reference,
            ],
        ]);
    }
}

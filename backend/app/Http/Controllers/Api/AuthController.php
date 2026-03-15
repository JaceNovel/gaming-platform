<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendPasswordResetLink;
use App\Models\Referral;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password as PasswordFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:7'],
            'email' => 'required|string|email|max:255|unique:users',
            'phone' => 'required|string|min:6|max:32',
            'password' => 'required|string|min:8|confirmed',
            'game_username' => 'nullable|string|max:255',
            'countryCode' => 'required|string|size:2',
            'countryName' => 'required|string|max:100',
            'referralCode' => 'nullable|string|max:32',
        ]);

        $normalizedName = $this->normalizeUsername((string) $request->input('name', ''));
        if ($normalizedName === '') {
            return response()->json([
                'message' => 'Pseudo indisponible.',
                'errors' => ['name' => ['Pseudo indisponible.']],
            ], 422);
        }

        if ($this->usernameExists($normalizedName)) {
            return response()->json([
                'message' => 'Pseudo indisponible.',
                'errors' => ['name' => ['Pseudo indisponible.']],
            ], 422);
        }

        $rawPhone = (string) $request->input('phone', '');
        $phoneDigits = preg_replace('/\D+/', '', $rawPhone) ?? '';
        if (strlen($phoneDigits) < 6) {
            return response()->json([
                'message' => 'Numéro de téléphone invalide.',
                'errors' => ['phone' => ['Numéro de téléphone invalide.']],
            ], 422);
        }

        $referralCode = strtoupper(trim((string) $request->input('referralCode', '')));
        $referrer = null;
        if ($referralCode !== '') {
            $referrer = User::query()
                ->whereRaw('UPPER(referral_code) = ?', [$referralCode])
                ->first();
            if (!$referrer) {
                return response()->json([
                    'message' => 'Code parrain invalide.',
                    'errors' => ['referralCode' => ['Code parrain invalide.']],
                ], 422);
            }
        }

        $user = User::create([
            'name' => $normalizedName,
            'email' => $request->email,
            'phone' => $phoneDigits,
            'password' => Hash::make($request->password),
            'game_username' => $request->game_username,
            'country_code' => strtoupper($request->countryCode),
            'country_name' => $request->countryName,
            'avatar_id' => 'shadow_default',
            'premium_tier' => 'Bronze',
            'is_premium' => false,
            'last_seen_at' => now(),
        ]);

        // Ensure every user can share a code (growth / viral loops).
        if (empty($user->referral_code)) {
            $tries = 0;
            $code = strtoupper(\Illuminate\Support\Str::random(8));
            while (User::where('referral_code', $code)->exists() && $tries < 10) {
                $code = strtoupper(\Illuminate\Support\Str::random(8));
                $tries++;
            }
            if (!User::whereRaw('UPPER(referral_code) = ?', [$code])->exists()) {
                $user->update(['referral_code' => $code]);
            } else {
                $fallbackCode = strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 12));
                if (!User::whereRaw('UPPER(referral_code) = ?', [$fallbackCode])->exists()) {
                    $user->update(['referral_code' => $fallbackCode]);
                }
            }
        } else {
            $normalizedCode = strtoupper((string) $user->referral_code);
            if ($normalizedCode !== (string) $user->referral_code) {
                try {
                    $conflict = User::query()
                        ->where('id', '!=', $user->id)
                        ->whereRaw('UPPER(referral_code) = ?', [$normalizedCode])
                        ->exists();

                    if (!$conflict) {
                        $user->update(['referral_code' => $normalizedCode]);
                    }
                } catch (\Throwable $e) {
                    Log::warning('referrals:code-normalization-skip', [
                        'user_id' => $user->id,
                        'message' => $e->getMessage(),
                    ]);
                }
            }
        }

        if ($referrer && $referrer->id !== $user->id) {
            // One referred user can only be attributed once.
            $alreadyAttributed = Referral::where('referred_id', $user->id)->exists();
            if (!$alreadyAttributed) {
                Referral::create([
                    'referrer_id' => $referrer->id,
                    'referred_id' => $user->id,
                    'commission_earned' => 0,
                ]);
            }
        }

        // DBWallet is created automatically at signup; wallet_id is required for support/admin operations.
        try {
            app(WalletService::class)->getOrCreateWallet($user);
        } catch (\Throwable $e) {
            // Best-effort: do not block registration.
        }

        $user->refresh();
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'user' => $this->transformUser($user),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        try {
            $user->forceFill(['last_seen_at' => now()])->save();
        } catch (\Throwable) {
            // best-effort
        }

        return response()->json([
            'user' => $this->transformUser($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->user()?->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', Password::defaults(), 'confirmed'],
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'Mot de passe actuel incorrect',
                'errors' => ['current_password' => ['Mot de passe actuel incorrect']],
            ], 422);
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
        ])->save();

        return response()->json(['message' => 'Mot de passe mis à jour']);
    }

    public function deleteAccount(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (!Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Mot de passe incorrect',
                'errors' => ['password' => ['Mot de passe incorrect']],
            ], 422);
        }

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            $user->notifications()->delete();
            $user->pushSubscriptions()->delete();
            $user->deviceTokens()->delete();
            $user->likes()->delete();
            $user->reviews()->delete();
            $user->cartItems()->delete();
            $user->supportTickets()->delete();
            $user->emailLogs()->delete();
            $user->adminLogs()->delete();
            $user->chatMessages()->delete();
            $user->chatMemberships()->delete();
            $user->chatRooms()->detach();
            $user->premiumMemberships()->delete();
            $user->referrals()->delete();
            $user->referredBy()->delete();
            $user->payouts()->delete();

            $orders = $user->orders()->get();
            foreach ($orders as $order) {
                $order->redeemCodeDeliveries()->delete();
                $order->refunds()->delete();
                $order->orderItems()->delete();
                $order->delete();
            }

            $walletAccount = $user->walletAccount;
            if ($walletAccount) {
                $walletAccount->transactions()->delete();
                $walletAccount->payouts()->delete();
                $walletAccount->delete();
            }

            $walletBd = $user->walletBd;
            if ($walletBd) {
                $walletBd->delete();
            }

            $user->delete();
        });

        return response()->json(['message' => 'Compte supprimé']);
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        try {
            SendPasswordResetLink::dispatch((string) $data['email'])->afterCommit();
        } catch (\Throwable) {
            // best-effort: never leak internal errors and never block the request
        }

        // Do not leak whether the email exists.
        return response()->json([
            'message' => 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string', Password::defaults(), 'confirmed'],
        ]);

        $status = PasswordFacade::reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $request->input('password_confirmation'),
                'token' => $data['token'],
            ],
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Invalidate API tokens on password reset.
                try {
                    $user->tokens()->delete();
                } catch (\Throwable) {
                    // best-effort
                }

                event(new PasswordReset($user));
            }
        );

        if ($status === PasswordFacade::PASSWORD_RESET) {
            return response()->json(['message' => 'Mot de passe réinitialisé.']);
        }

        return response()->json([
            'message' => 'Lien de réinitialisation invalide ou expiré.',
            'errors' => ['token' => ['Lien de réinitialisation invalide ou expiré.']],
        ], 422);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $this->transformUser($request->user()),
        ]);
    }

    private function transformUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'country_code' => $user->country_code,
            'country_name' => $user->country_name,
            'role' => $user->role,
            'is_premium' => (bool) $user->is_premium,
            'premium_level' => $user->premium_level,
            'premium_expiration' => optional($user->premium_expiration)?->toIso8601String(),
            'referral_code' => $user->referral_code,
        ];
    }

    private function normalizeUsername(string $value): string
    {
        return strtoupper(trim($value));
    }

    private function usernameExists(string $normalizedName, ?int $ignoreUserId = null): bool
    {
        $query = User::query()->whereRaw('UPPER(name) = ?', [$normalizedName]);
        if ($ignoreUserId) {
            $query->where('id', '!=', $ignoreUserId);
        }

        return $query->exists();
    }
}

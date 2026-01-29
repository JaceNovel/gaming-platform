<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Referral;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:7',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'game_username' => 'nullable|string|max:255',
            'countryCode' => 'required|string|size:2',
            'countryName' => 'required|string|max:100',
            'referralCode' => 'nullable|string|max:32',
        ]);

        $referralCode = trim((string) $request->input('referralCode', ''));
        $referrer = null;
        if ($referralCode !== '') {
            $referrer = User::where('referral_code', $referralCode)->first();
            $isVip = $referrer && (bool) $referrer->is_premium && in_array((string) $referrer->premium_level, ['bronze', 'platine'], true);
            if (!$isVip) {
                return response()->json([
                    'message' => 'Code parrain invalide.',
                    'errors' => ['referralCode' => ['Code parrain invalide.']],
                ], 422);
            }
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'game_username' => $request->game_username,
            'country_code' => strtoupper($request->countryCode),
            'country_name' => $request->countryName,
            'avatar_id' => 'shadow_default',
            'premium_tier' => 'Bronze',
            'is_premium' => false,
        ]);

        if ($referrer && $referrer->id !== $user->id) {
            Referral::firstOrCreate(
                ['referrer_id' => $referrer->id, 'referred_id' => $user->id],
                ['commission_earned' => 0]
            );
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
            'role' => $user->role,
            'is_premium' => (bool) $user->is_premium,
            'premium_level' => $user->premium_level,
            'premium_expiration' => optional($user->premium_expiration)?->toIso8601String(),
            'referral_code' => $user->referral_code,
        ];
    }
}

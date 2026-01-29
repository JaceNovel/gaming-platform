<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Referral;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReferralController extends Controller
{
    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        if (empty($user->referral_code)) {
            $user->referral_code = $this->generateUniqueCode();
            $user->save();
            $user->refresh();
        }

        $siteUrl = rtrim((string) env('FRONTEND_URL', config('app.url')), '/');
        $shareLink = $siteUrl . '/auth/register?ref=' . urlencode((string) $user->referral_code);

        $referrals = Referral::query()
            ->where('referrer_id', $user->id)
            ->with(['referred:id,name,email,created_at'])
            ->orderByDesc('id')
            ->get();

        $totalCommission = (float) $referrals->sum(fn ($r) => (float) ($r->commission_earned ?? 0));

        return response()->json([
            'referral' => [
                'code' => $user->referral_code,
                'link' => $shareLink,
                'referred_count' => $referrals->count(),
                'commission_total' => $totalCommission,
            ],
            'items' => $referrals->map(function (Referral $ref) {
                return [
                    'id' => $ref->id,
                    'referred' => $ref->referred ? [
                        'id' => $ref->referred->id,
                        'name' => $ref->referred->name,
                        'created_at' => optional($ref->referred->created_at)?->toIso8601String(),
                    ] : null,
                    'commission_earned' => (float) ($ref->commission_earned ?? 0),
                    'commission_rate' => $ref->commission_rate !== null ? (float) $ref->commission_rate : null,
                    'commission_base_amount' => $ref->commission_base_amount !== null ? (float) $ref->commission_base_amount : null,
                    'rewarded_at' => optional($ref->rewarded_at)?->toIso8601String(),
                    'created_at' => optional($ref->created_at)?->toIso8601String(),
                ];
            })->values(),
        ]);
    }

    public function generate(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        if (!empty($user->referral_code)) {
            return response()->json([
                'referral_code' => $user->referral_code,
                'message' => 'Code déjà existant',
            ]);
        }

        $user->referral_code = $this->generateUniqueCode();
        $user->save();

        return response()->json([
            'referral_code' => $user->referral_code,
        ]);
    }

    private function generateUniqueCode(): string
    {
        // Keep it short and shareable.
        // We try a few times to avoid race collisions.
        return DB::transaction(function () {
            $tries = 0;
            do {
                $code = strtoupper(Str::random(8));
                $exists = User::where('referral_code', $code)->exists();
                $tries++;
            } while ($exists && $tries < 10);

            if ($exists) {
                $code = strtoupper(Str::uuid()->toString());
            }

            return $code;
        });
    }
}

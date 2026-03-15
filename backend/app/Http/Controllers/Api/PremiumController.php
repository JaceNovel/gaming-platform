<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PremiumRequest;
use App\Services\PremiumPartnershipService;
use Illuminate\Http\Request;

class PremiumController extends Controller
{
    public function __construct(private PremiumPartnershipService $premiumPartnerships)
    {
    }

    public function status(Request $request)
    {
        $user = $request->user();
        $membership = $user->premiumMemberships()->latest()->first();
        $latestRequest = $user->premiumRequests()->latest()->first();

        return response()->json([
            'is_premium' => (bool) $user->is_premium,
            'level' => $user->premium_level,
            'expiration' => optional($user->premium_expiration)?->toIso8601String(),
            'membership' => $membership,
            'renewal_count' => $membership ? $membership->renewal_count : 0,
            'request' => $this->premiumPartnerships->serializeForApi($latestRequest),
            'plans' => $this->premiumPartnerships->planCatalog(),
        ]);
    }

    public function submit(Request $request)
    {
        $validated = $request->validate([
            'level' => 'required|in:bronze,platine',
            'social_platform' => 'required|string|max:120',
            'social_handle' => 'nullable|string|max:120',
            'social_url' => 'nullable|url|max:500',
            'followers_count' => 'required|integer|min:0',
            'other_platforms' => 'nullable|string|max:3000',
            'promotion_channels' => 'nullable|string|max:3000',
            'motivation' => 'required|string|max:3000',
        ]);

        $premiumRequest = $this->premiumPartnerships->submit($request->user(), $validated);

        return response()->json([
            'message' => 'Ta demande Premium a bien été envoyée.',
            'request' => $this->premiumPartnerships->serializeForApi($premiumRequest),
        ]);
    }

    public function init(Request $request)
    {
        return response()->json([
            'message' => 'Le programme Premium fonctionne désormais sur demande avec validation admin.',
        ], 410);
    }

    public function initWallet(Request $request)
    {
        return response()->json([
            'message' => 'Le programme Premium fonctionne désormais sur demande avec validation admin.',
        ], 410);
    }

    public function subscribe(Request $request)
    {
        return response()->json([
            'message' => 'Le programme Premium fonctionne désormais sur demande avec validation admin.',
        ], 410);
    }

    public function cancel(Request $request)
    {
        return response()->json([
            'message' => 'La résiliation automatique n\'est plus disponible sur ce programme Premium.',
        ], 410);
    }
}

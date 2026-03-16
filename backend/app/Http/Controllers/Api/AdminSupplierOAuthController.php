<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupplierAccount;
use App\Services\SupplierOAuthService;
use Illuminate\Http\Request;

class AdminSupplierOAuthController extends Controller
{
    public function connect(Request $request, SupplierAccount $supplierAccount, SupplierOAuthService $oauthService)
    {
        return response()->json([
            'authorization_url' => $oauthService->createAuthorizationUrl($supplierAccount, $request->user()?->id),
        ]);
    }

    public function refresh(Request $request, SupplierAccount $supplierAccount, SupplierOAuthService $oauthService)
    {
        $refreshed = $oauthService->refreshToken($supplierAccount);

        return response()->json([
            'data' => $this->transform($refreshed),
        ]);
    }

    public function callback(string $platform, Request $request, SupplierOAuthService $oauthService)
    {
        $request->validate([
            'state' => 'required|string',
            'code' => 'required|string',
        ]);

        try {
            $oauthService->handleCallback($platform, (string) $request->query('state'), (string) $request->query('code'));
            $front = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
            return redirect()->away($front . '/admin/sourcing/accounts?oauth=success&platform=' . urlencode($platform));
        } catch (\Throwable $e) {
            $front = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
            return redirect()->away($front . '/admin/sourcing/accounts?oauth=error&platform=' . urlencode($platform) . '&message=' . urlencode($e->getMessage()));
        }
    }

    private function transform(SupplierAccount $account): array
    {
        return [
            'id' => $account->id,
            'platform' => $account->platform,
            'label' => $account->label,
            'member_id' => $account->member_id,
            'resource_owner' => $account->resource_owner,
            'app_key' => $account->app_key,
            'country_code' => $account->country_code,
            'currency_code' => $account->currency_code,
            'scopes_json' => $account->scopes_json,
            'is_active' => (bool) $account->is_active,
            'access_token_expires_at' => optional($account->access_token_expires_at)->toIso8601String(),
            'refresh_token_expires_at' => optional($account->refresh_token_expires_at)->toIso8601String(),
            'last_sync_at' => optional($account->last_sync_at)->toIso8601String(),
            'last_error_at' => optional($account->last_error_at)->toIso8601String(),
            'last_error_message' => $account->last_error_message,
            'has_app_secret' => !empty($account->app_secret),
            'has_access_token' => !empty($account->access_token),
            'has_refresh_token' => !empty($account->refresh_token),
        ];
    }
}
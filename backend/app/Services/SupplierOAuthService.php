<?php

namespace App\Services;

use App\Models\SupplierAccount;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SupplierOAuthService
{
    public function createAuthorizationUrl(SupplierAccount $account, ?int $adminUserId = null): string
    {
        $config = $this->platformConfig($account->platform);
        $authorizeUrl = trim((string) ($config['authorize_url'] ?? ''));
        if ($authorizeUrl === '') {
            throw new \RuntimeException('URL OAuth authorize non configurée pour ' . $account->platform);
        }

        $appKey = trim((string) ($account->app_key ?? ''));
        if ($appKey === '') {
            throw new \RuntimeException('App Key manquante sur le compte fournisseur.');
        }

        $state = 'supplier-oauth:' . Str::random(40);
        $ttl = max(1, (int) config('services.sourcing.oauth_state_ttl_minutes', 15));
        Cache::put($state, [
            'supplier_account_id' => $account->id,
            'platform' => $account->platform,
            'admin_user_id' => $adminUserId,
        ], now()->addMinutes($ttl));

        $query = array_filter([
            'client_id' => $appKey,
            'app_key' => $appKey,
            'redirect_uri' => $this->callbackUrl($account->platform),
            'response_type' => 'code',
            'scope' => trim((string) ($config['default_scope'] ?? '')) ?: null,
            'state' => $state,
        ], static fn ($value) => $value !== null && $value !== '');

        return $authorizeUrl . (str_contains($authorizeUrl, '?') ? '&' : '?') . Arr::query($query);
    }

    public function handleCallback(string $platform, string $state, string $code): SupplierAccount
    {
        $cached = Cache::pull($state);
        if (!is_array($cached) || (string) ($cached['platform'] ?? '') !== $platform) {
            throw new \RuntimeException('État OAuth invalide ou expiré.');
        }

        $account = SupplierAccount::query()->findOrFail((int) $cached['supplier_account_id']);
        $tokens = $this->exchangeCode($account, $code);

        $account->update([
            'access_token' => $tokens['access_token'] ?? $account->access_token,
            'refresh_token' => $tokens['refresh_token'] ?? $account->refresh_token,
            'access_token_expires_at' => $tokens['access_token_expires_at'] ?? $account->access_token_expires_at,
            'refresh_token_expires_at' => $tokens['refresh_token_expires_at'] ?? $account->refresh_token_expires_at,
            'resource_owner' => $tokens['resource_owner'] ?? $account->resource_owner,
            'member_id' => $tokens['member_id'] ?? $account->member_id,
            'last_sync_at' => now(),
            'last_error_at' => null,
            'last_error_message' => null,
        ]);

        return $account->fresh();
    }

    public function refreshToken(SupplierAccount $account): SupplierAccount
    {
        $config = $this->platformConfig($account->platform);
        $refreshUrl = trim((string) ($config['refresh_url'] ?? ''));
        if ($refreshUrl === '') {
            throw new \RuntimeException('URL OAuth refresh non configurée pour ' . $account->platform);
        }

        $response = Http::asForm()
            ->timeout((int) ($config['timeout'] ?? 20))
            ->acceptJson()
            ->post($refreshUrl, array_filter([
                'grant_type' => 'refresh_token',
                'refresh_token' => $account->refresh_token,
                'client_id' => $account->app_key,
                'app_key' => $account->app_key,
                'client_secret' => $account->app_secret,
                'app_secret' => $account->app_secret,
                'redirect_uri' => $this->callbackUrl($account->platform),
            ], static fn ($value) => $value !== null && $value !== ''));

        if (!$response->successful()) {
            throw new \RuntimeException('Refresh token échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        $parsed = $this->parseTokenResponse($response->json() ?? []);
        $account->update([
            'access_token' => $parsed['access_token'] ?? $account->access_token,
            'refresh_token' => $parsed['refresh_token'] ?? $account->refresh_token,
            'access_token_expires_at' => $parsed['access_token_expires_at'] ?? $account->access_token_expires_at,
            'refresh_token_expires_at' => $parsed['refresh_token_expires_at'] ?? $account->refresh_token_expires_at,
            'last_sync_at' => now(),
            'last_error_at' => null,
            'last_error_message' => null,
        ]);

        return $account->fresh();
    }

    private function exchangeCode(SupplierAccount $account, string $code): array
    {
        $config = $this->platformConfig($account->platform);
        $tokenUrl = trim((string) ($config['token_url'] ?? ''));
        if ($tokenUrl === '') {
            throw new \RuntimeException('URL OAuth token non configurée pour ' . $account->platform);
        }

        $response = Http::asForm()
            ->timeout((int) ($config['timeout'] ?? 20))
            ->acceptJson()
            ->post($tokenUrl, array_filter([
                'grant_type' => 'authorization_code',
                'code' => $code,
                'client_id' => $account->app_key,
                'app_key' => $account->app_key,
                'client_secret' => $account->app_secret,
                'app_secret' => $account->app_secret,
                'redirect_uri' => $this->callbackUrl($account->platform),
            ], static fn ($value) => $value !== null && $value !== ''));

        if (!$response->successful()) {
            throw new \RuntimeException('Échange de code OAuth échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        return $this->parseTokenResponse($response->json() ?? []);
    }

    private function parseTokenResponse(array $payload): array
    {
        $accessToken = $payload['access_token'] ?? $payload['accessToken'] ?? data_get($payload, 'result.access_token');
        $refreshToken = $payload['refresh_token'] ?? $payload['refreshToken'] ?? data_get($payload, 'result.refresh_token');
        $accessExpiresIn = (int) ($payload['expires_in'] ?? $payload['access_token_expire_in'] ?? data_get($payload, 'result.expires_in') ?? 0);
        $refreshExpiresIn = (int) ($payload['refresh_token_expires_in'] ?? data_get($payload, 'result.refresh_token_expires_in') ?? 0);

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'access_token_expires_at' => $accessExpiresIn > 0 ? now()->addSeconds($accessExpiresIn) : null,
            'refresh_token_expires_at' => $refreshExpiresIn > 0 ? now()->addSeconds($refreshExpiresIn) : null,
            'resource_owner' => $payload['resource_owner'] ?? $payload['resourceOwner'] ?? null,
            'member_id' => $payload['member_id'] ?? $payload['memberId'] ?? null,
        ];
    }

    private function callbackUrl(string $platform): string
    {
        $configured = trim((string) data_get(config('services.sourcing.platforms'), $platform . '.callback_url', ''));
        if ($configured !== '') {
            return $configured;
        }

        $base = rtrim((string) config('app.url'), '/');
        return $base . '/api/sourcing/oauth/' . $platform . '/callback';
    }

    private function platformConfig(string $platform): array
    {
        return (array) data_get(config('services.sourcing.platforms'), $platform, []);
    }
}
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
            'redirect_uri' => $this->callbackUrl($account->platform),
            'response_type' => 'code',
            'scope' => trim((string) ($config['default_scope'] ?? '')) ?: null,
            'state' => $state,
            'force_auth' => filter_var($config['authorize_force_auth'] ?? false, FILTER_VALIDATE_BOOL) ? 'true' : null,
            'uuid' => trim((string) ($config['authorize_uuid'] ?? '')) ?: null,
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

        $parsed = $this->ioRequest($account, $refreshUrl, [
            'refresh_token' => (string) ($account->refresh_token ?? ''),
        ]);

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

        return $this->ioRequest($account, $tokenUrl, [
            'code' => $code,
        ]);
    }

    private function parseTokenResponse(array $payload): array
    {
        $accessToken = $payload['access_token'] ?? $payload['accessToken'] ?? null;
        $refreshToken = $payload['refresh_token'] ?? $payload['refreshToken'] ?? null;
        $expireTimeMs = (int) ($payload['expire_time'] ?? 0);
        $refreshValidTimeMs = (int) ($payload['refresh_token_valid_time'] ?? 0);
        $expiresIn = (int) ($payload['expires_in'] ?? 0);
        $refreshExpiresIn = (int) ($payload['refresh_expires_in'] ?? 0);

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'access_token_expires_at' => $expireTimeMs > 0
                ? now()->setTimestamp((int) floor($expireTimeMs / 1000))
                : ($expiresIn > 0 ? now()->addSeconds($expiresIn) : null),
            'refresh_token_expires_at' => $refreshValidTimeMs > 0
                ? now()->setTimestamp((int) floor($refreshValidTimeMs / 1000))
                : ($refreshExpiresIn > 0 ? now()->addSeconds($refreshExpiresIn) : null),
            'resource_owner' => $payload['account'] ?? $payload['user_nick'] ?? null,
            'member_id' => $payload['seller_id'] ?? $payload['user_id'] ?? $payload['account_id'] ?? null,
            'scopes_json' => array_values(array_filter([
                $payload['sp'] ?? null,
                $payload['country'] ?? null,
                $payload['account_platform'] ?? null,
            ])),
        ];
    }

    private function ioRequest(SupplierAccount $account, string $url, array $params): array
    {
        $config = $this->platformConfig($account->platform);
        $response = Http::asForm()
            ->timeout((int) ($config['timeout'] ?? 20))
            ->acceptJson()
            ->post($url, array_filter($params, static fn ($value) => $value !== null && $value !== ''));

        if (!$response->successful()) {
            throw new \RuntimeException('Appel OAuth IOP échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        $payload = $response->json() ?? [];
        if ((string) ($payload['code'] ?? '0') !== '0') {
            throw new \RuntimeException(($payload['message'] ?? 'Erreur OAuth IOP') . ' [' . ($payload['code'] ?? 'unknown') . ']');
        }

        return $this->parseTokenResponse($payload);
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
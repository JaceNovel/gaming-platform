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

        $state = 'supplieroauth' . Str::random(32);
        $ttl = max(1, (int) config('services.sourcing.oauth_state_ttl_minutes', 15));
        Cache::put($state, [
            'supplier_account_id' => $account->id,
            'platform' => $account->platform,
            'admin_user_id' => $adminUserId,
        ], now()->addMinutes($ttl));

        $query = [
            'client_id' => $appKey,
            'redirect_uri' => $this->callbackUrl($account->platform),
            'response_type' => 'code',
            'state' => $state,
        ];

        if (filter_var($config['include_optional_authorize_params'] ?? false, FILTER_VALIDATE_BOOL)) {
            $query = array_merge($query, array_filter([
                'scope' => trim((string) ($config['default_scope'] ?? '')) ?: null,
                'force_auth' => filter_var($config['authorize_force_auth'] ?? false, FILTER_VALIDATE_BOOL) ? 'true' : null,
                'uuid' => trim((string) ($config['authorize_uuid'] ?? '')) ?: null,
            ], static fn ($value) => $value !== null && $value !== ''));
        }

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
        $request = Http::asForm()
            ->timeout((int) ($config['timeout'] ?? 20))
            ->acceptJson();

        $filteredParams = array_filter($params, static fn ($value) => $value !== null && $value !== '');
        $resolvedUrl = $this->resolveIoAuthUrl($account, $url);
        $path = (string) (parse_url($resolvedUrl, PHP_URL_PATH) ?: '/auth/token/create');
        $signedParams = $this->buildIoAuthRequestParams($account, $path, $filteredParams);
        $headers = $this->buildIoAuthHeaders($signedParams);

        $attempt = 'body-post';
        $response = $request->post($resolvedUrl, $signedParams);

        if ($response->status() === 404 || $response->status() === 405) {
            $attempt = 'query-get';
            $response = $request->get($resolvedUrl, $signedParams);
        }

        if (!$response->successful() && in_array($response->status(), [400, 401, 403, 404, 405], true)) {
            $attempt = 'header-post';
            $response = $request->withHeaders($headers)->post($resolvedUrl, $filteredParams);
        }

        if (!$response->successful() && in_array($response->status(), [400, 401, 403, 404, 405], true)) {
            $attempt = 'header-get';
            $response = $request->withHeaders($headers)->get($resolvedUrl, $filteredParams);
        }

        if (!$response->successful()) {
            throw new \RuntimeException('Appel OAuth IOP échoué (HTTP ' . $response->status() . ', mode ' . $attempt . ', url ' . $resolvedUrl . '): ' . $response->body());
        }

        $payload = $response->json() ?? [];
        if ((string) ($payload['code'] ?? '0') !== '0') {
            throw new \RuntimeException(($payload['message'] ?? 'Erreur OAuth IOP') . ' [' . ($payload['code'] ?? 'unknown') . ']');
        }

        return $this->parseTokenResponse($payload);
    }

    private function resolveIoAuthUrl(SupplierAccount $account, string $url): string
    {
        $host = (string) (parse_url($url, PHP_URL_HOST) ?? '');
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');

        if ($host === 'openapi-auth.alibaba.com') {
            $apiBaseUrl = rtrim((string) data_get($this->platformConfig($account->platform), 'api_base_url', ''), '/');
            if ($apiBaseUrl !== '' && $path !== '') {
                return $this->withIoRestPrefix($apiBaseUrl . $path);
            }
        }

        if ($host === 'openapi.alibaba.com' && $path !== '') {
            return $this->withIoRestPrefix($url);
        }

        return $url;
    }

    private function withIoRestPrefix(string $url): string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
        if ($path === '' || str_starts_with($path, '/rest/')) {
            return $url;
        }

        $base = rtrim((string) preg_replace('#' . preg_quote($path, '#') . '$#', '', $url), '/');

        return $base . '/rest' . (str_starts_with($path, '/') ? $path : '/' . $path);
    }

    private function buildIoAuthRequestParams(SupplierAccount $account, string $path, array $params): array
    {
        $appKey = trim((string) ($account->app_key ?? ''));
        $appSecret = (string) ($account->app_secret ?? '');
        if ($appKey === '' || $appSecret === '') {
            throw new \RuntimeException('App Key / App Secret manquants pour l’échange OAuth IOP.');
        }

        $requestParams = array_merge($params, [
            'app_key' => $appKey,
            'timestamp' => (string) round(microtime(true) * 1000),
            'sign_method' => strtolower((string) data_get($this->platformConfig($account->platform), 'sign_method', 'sha256')) === 'md5'
                ? 'md5'
                : 'sha256',
        ]);

        ksort($requestParams);
        $payload = $path;
        foreach ($requestParams as $key => $value) {
            $payload .= $key . $value;
        }

        $algorithm = $requestParams['sign_method'];

        $requestParams['sign'] = strtoupper(hash_hmac($algorithm, $payload, $appSecret));

        return $requestParams;
    }

    private function buildIoAuthHeaders(array $params): array
    {
        return Arr::only($params, ['app_key', 'timestamp', 'sign_method', 'sign']);
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
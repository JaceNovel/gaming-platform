<?php

namespace App\Services;

use App\Models\SupplierAccount;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str as SupportStr;
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
            'State' => $state,
            'view' => trim((string) ($config['authorize_view'] ?? '')) ?: null,
            'sp' => trim((string) ($config['authorize_sp'] ?? '')) ?: null,
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

        $parsed = $this->topRequest($account, $refreshUrl, [
            'method' => (string) ($config['token_refresh_method'] ?? 'taobao.top.auth.token.refresh'),
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

        return $this->topRequest($account, $tokenUrl, [
            'method' => (string) ($config['token_create_method'] ?? 'taobao.top.auth.token.create'),
            'code' => $code,
        ]);
    }

    private function parseTokenResponse(array $payload): array
    {
        $tokenResult = $payload['token_result'] ?? $payload['tokenResult'] ?? data_get($payload, 'result.token_result') ?? data_get($payload, 'result.tokenResult');
        if (is_string($tokenResult) && SupportStr::startsWith(ltrim($tokenResult), '{')) {
            $decoded = json_decode($tokenResult, true);
            if (is_array($decoded)) {
                $payload = array_merge($payload, $decoded);
            }
        } elseif (is_array($tokenResult)) {
            $payload = array_merge($payload, $tokenResult);
        }

        $accessToken = $payload['access_token'] ?? $payload['accessToken'] ?? data_get($payload, 'result.access_token');
        $refreshToken = $payload['refresh_token'] ?? $payload['refreshToken'] ?? data_get($payload, 'result.refresh_token');
        $expireTimeMs = (int) ($payload['expire_time'] ?? data_get($payload, 'result.expire_time') ?? 0);
        $refreshValidTimeMs = (int) ($payload['refresh_token_valid_time'] ?? data_get($payload, 'result.refresh_token_valid_time') ?? 0);

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'access_token_expires_at' => $expireTimeMs > 0 ? now()->setTimestamp((int) floor($expireTimeMs / 1000)) : null,
            'refresh_token_expires_at' => $refreshValidTimeMs > 0 ? now()->setTimestamp((int) floor($refreshValidTimeMs / 1000)) : null,
            'resource_owner' => $payload['user_nick'] ?? $payload['resource_owner'] ?? $payload['resourceOwner'] ?? null,
            'member_id' => $payload['user_id'] ?? $payload['member_id'] ?? $payload['memberId'] ?? null,
            'scopes_json' => array_values(array_filter([
                $payload['sp'] ?? null,
                $payload['locale'] ?? null,
            ])),
        ];
    }

    private function topRequest(SupplierAccount $account, string $url, array $params): array
    {
        $config = $this->platformConfig($account->platform);
        $signMethod = strtolower((string) ($config['top_sign_method'] ?? 'md5'));
        $requestParams = array_filter([
            'app_key' => $account->app_key,
            'timestamp' => now()->timezone('Asia/Shanghai')->format('Y-m-d H:i:s'),
            'format' => 'json',
            'v' => (string) ($config['top_version'] ?? '2.0'),
            'sign_method' => $signMethod,
            'simplify' => 'true',
        ] + $params, static fn ($value) => $value !== null && $value !== '');

        $requestParams['sign'] = $this->buildTopSignature($requestParams, (string) ($account->app_secret ?? ''), $signMethod);

        $response = Http::asForm()
            ->timeout((int) ($config['timeout'] ?? 20))
            ->acceptJson()
            ->post($url, $requestParams);

        if (!$response->successful()) {
            throw new \RuntimeException('Appel TOP échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        $payload = $response->json() ?? [];
        if (isset($payload['error_response'])) {
            $error = $payload['error_response'];
            throw new \RuntimeException(($error['sub_msg'] ?? $error['msg'] ?? 'Erreur TOP') . ' [' . ($error['sub_code'] ?? $error['code'] ?? 'unknown') . ']');
        }

        $responseNode = collect($payload)
            ->filter(fn ($value, $key) => is_string($key) && str_ends_with($key, '_response'))
            ->first();

        if (is_array($responseNode)) {
            return $this->parseTokenResponse($responseNode);
        }

        return $this->parseTokenResponse($payload);
    }

    private function buildTopSignature(array $params, string $secret, string $signMethod): string
    {
        unset($params['sign']);
        ksort($params);

        $concatenated = '';
        foreach ($params as $key => $value) {
            if (is_array($value)) {
                $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            if ($value === null || $value === '') {
                continue;
            }
            $concatenated .= $key . (string) $value;
        }

        return match ($signMethod) {
            'hmac', 'hmac-md5' => strtoupper(hash_hmac('md5', $concatenated, $secret)),
            'hmac-sha256' => strtoupper(hash_hmac('sha256', $concatenated, $secret)),
            default => strtoupper(md5($secret . $concatenated . $secret)),
        };
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